import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { Clock } from '../common/clock';
import { IdFactory } from '../common/ids';
import { DiscoveryService } from '../discovery/discovery.service';
import { SellersService } from '../sellers/sellers.service';
import { BnplService } from './bnpl.service';
import { Order, OrderLine, OrderStatus, PlaceOrderInput } from './checkout.types';

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  reserved: ['paid', 'cancelled'],
  paid: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'out_for_delivery'],
  ready: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class CheckoutService {
  private readonly orders = new Map<string, Order>();

  constructor(
    private readonly ids: IdFactory,
    private readonly clock: Clock,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
    private readonly discovery: DiscoveryService,
    private readonly bnpl: BnplService,
  ) {}

  get(id: string): Order {
    const order = this.orders.get(id);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  place(input: PlaceOrderInput): Order {
    const lines = this.buildLines(input);
    const totalCents = lines.reduce((sum, line) => sum + line.unitCents * line.qty, 0);
    const prepMinutes = this.prepMinutes(input);
    if (input.payMethod === 'layaway') {
      const count = input.layawayCount ?? 3;
      if (count < 2) throw new BadRequestException('Layaway needs at least two installments');
      this.holdSkus(lines, 'layaway');
      return this.create({
        input,
        lines,
        totalCents,
        prepMinutes,
        status: 'reserved',
        layaway: { count, paidCount: 1, installmentCents: Math.ceil(totalCents / count) },
      });
    }
    if (input.payMethod === 'bnpl') {
      const quote = this.bnpl.requireQuote(input.bnplPartner, totalCents);
      this.sellSkus(lines, 'bnpl');
      return this.create({
        input,
        lines,
        totalCents,
        prepMinutes,
        status: 'paid',
        bnpl: {
          partner: quote.partner,
          reference: quote.reference!,
          installmentCount: quote.installmentCount!,
          installmentCents: quote.installmentCents!,
          mode: 'sandbox',
        },
      });
    }
    this.sellSkus(lines, 'sale');
    return this.create({ input, lines, totalCents, prepMinutes, status: 'paid' });
  }

  payLayaway(orderId: string): Order {
    const order = this.get(orderId);
    if (!order.layaway) throw new BadRequestException('Not a layaway order');
    if (order.layaway.paidCount >= order.layaway.count) {
      throw new BadRequestException('Layaway is already settled');
    }
    order.layaway.paidCount += 1;
    if (order.layaway.paidCount === order.layaway.count) {
      for (const line of order.lines) {
        if (line.skuId) this.catalog.commitReserved(line.skuId, line.qty, 'layaway_complete');
      }
      order.status = 'paid';
    }
    return order;
  }

  settleGroup(groupId: string): Order[] {
    const group = this.discovery.group(groupId);
    if (group.settled) throw new BadRequestException('Group buy already settled');
    if (this.clock.now() >= Date.parse(group.deadline) && group.members.length === 0) {
      throw new BadRequestException('Group buy expired with no members');
    }
    const joined = group.members.reduce((sum, member) => sum + member.qty, 0);
    if (joined < group.targetQty) throw new BadRequestException('Group has not reached its target');
    const sku = this.catalog.get(group.skuId);
    const orders = group.members.map((member) => {
      this.catalog.commitReserved(sku.id, member.qty, 'group_buy');
      const line: OrderLine = {
        skuId: sku.id,
        name: sku.name.en,
        qty: member.qty,
        unitCents: member.unitCents,
      };
      return this.create({
        input: {
          buyerId: member.buyerId,
          stallId: sku.stallId,
          payMethod: 'pay_now',
          fulfillment: 'pickup',
        },
        lines: [line],
        totalCents: line.unitCents * line.qty,
        prepMinutes: 0,
        status: 'paid',
      });
    });
    this.discovery.markGroupSettled(group.id);
    return orders;
  }

  settleAuction(auctionId: string): Order {
    const auction = this.discovery.auction(auctionId);
    if (auction.settled) throw new BadRequestException('Auction already settled');
    if (this.clock.now() < Date.parse(auction.endsAt)) throw new BadRequestException('Auction still open');
    if (!auction.highBidderId) throw new BadRequestException('No bids');
    const sku = this.catalog.get(auction.skuId);
    this.catalog.commitReserved(sku.id, 1, 'auction');
    const order = this.create({
      input: {
        buyerId: auction.highBidderId,
        stallId: sku.stallId,
        payMethod: 'pay_now',
        fulfillment: 'pickup',
      },
      lines: [{ skuId: sku.id, name: sku.name.en, qty: 1, unitCents: auction.highBidCents }],
      totalCents: auction.highBidCents,
      prepMinutes: 0,
      status: 'paid',
    });
    this.discovery.markAuctionSettled(auction.id);
    return order;
  }

  mark(orderId: string, status: OrderStatus): Order {
    const order = this.get(orderId);
    if (!NEXT[order.status].includes(status)) {
      throw new BadRequestException(`Cannot move order from ${order.status} to ${status}`);
    }
    order.status = status;
    return order;
  }

  private buildLines(input: PlaceOrderInput): OrderLine[] {
    const stall = this.sellers.get(input.stallId);
    const lines: OrderLine[] = [];
    for (const line of input.skuLines ?? []) {
      if (line.qty < 1) throw new BadRequestException('Quantity must be at least 1');
      const sku = this.catalog.get(line.skuId);
      if (sku.stallId !== stall.id) throw new BadRequestException('SKU is from another stall');
      const quote = this.discovery.priceFor(sku.id);
      lines.push({
        skuId: sku.id,
        name: sku.name.en,
        qty: line.qty,
        unitCents: line.unitPriceOverrideCents ?? quote.priceCents,
      });
    }
    for (const line of input.menuLines ?? []) {
      if (line.qty < 1) throw new BadRequestException('Quantity must be at least 1');
      const item = stall.menu.find((menuItem) => menuItem.id === line.menuItemId);
      if (!item) throw new NotFoundException(`Menu item ${line.menuItemId} not found`);
      lines.push({
        menuItemId: item.id,
        name: item.name.en,
        qty: line.qty,
        unitCents: item.priceCents,
      });
    }
    if (!lines.length) throw new BadRequestException('Order is empty');
    return lines;
  }

  private prepMinutes(input: PlaceOrderInput): number {
    const stall = this.sellers.get(input.stallId);
    const times = (input.menuLines ?? []).map((line) => {
      const item = stall.menu.find((menuItem) => menuItem.id === line.menuItemId);
      return item ? item.prepMinutes : 0;
    });
    return times.length ? Math.max(...times) : 0;
  }

  private sellSkus(lines: OrderLine[], reason: string): void {
    for (const line of lines) {
      if (line.skuId) this.catalog.commitSale(line.skuId, line.qty, reason);
    }
  }

  private holdSkus(lines: OrderLine[], reason: string): void {
    for (const line of lines) {
      if (line.skuId) this.catalog.reserve(line.skuId, line.qty, reason);
    }
  }

  private create(args: {
    input: Pick<PlaceOrderInput, 'buyerId' | 'stallId' | 'payMethod' | 'fulfillment'>;
    lines: OrderLine[];
    totalCents: number;
    prepMinutes: number;
    status: OrderStatus;
    layaway?: Order['layaway'];
    bnpl?: Order['bnpl'];
  }): Order {
    const order: Order = {
      id: this.ids.next('ord'),
      buyerId: args.input.buyerId,
      stallId: args.input.stallId,
      lines: args.lines,
      totalCents: args.totalCents,
      payMethod: args.input.payMethod,
      fulfillment: args.input.fulfillment,
      status: args.status,
      layaway: args.layaway,
      bnpl: args.bnpl,
      prepMinutes: args.prepMinutes,
      createdAt: this.clock.iso(),
    };
    this.orders.set(order.id, order);
    return order;
  }
}
