import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { CatalogService } from '../catalog/catalog.service';
import { StockTicker } from '../catalog/stock-ticker';
import { Clock } from '../common/clock';
import { haversineKm, roundKm } from '../common/geo';
import { IdFactory } from '../common/ids';
import { I18nService } from '../i18n/i18n.service';
import { SellersService } from '../sellers/sellers.service';
import { StallEvents } from '../sellers/stall-events';
import { Auction, FlashSale, GroupBuy, MapFeedEvent, PriceQuote, WishlistEntry } from './discovery.types';

/** Paid boost lifts a stall by this many kilometres on the map rank. */
const VISIBILITY_LIFT_KM = 3;

@Injectable()
export class DiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly flashes = new Map<string, FlashSale>();
  private readonly auctions = new Map<string, Auction>();
  private readonly groups = new Map<string, GroupBuy>();
  private readonly wishlist: WishlistEntry[] = [];
  private readonly feed: MapFeedEvent[] = [];
  private version = 0;
  private stockSub?: Subscription;
  private stallSub?: Subscription;

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly i18n: I18nService,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
    private readonly ticker: StockTicker,
    private readonly stallEvents: StallEvents,
  ) {}

  onModuleInit(): void {
    this.stockSub = this.ticker.ticks$.subscribe((tick) => {
      this.bump({ type: 'stock', stallId: tick.stallId, skuId: tick.skuId });
    });
    this.stallSub = this.stallEvents.stream$.subscribe((event) => {
      this.bump({ type: 'stall', stallId: event.stallId });
    });
  }

  onModuleDestroy(): void {
    this.stockSub?.unsubscribe();
    this.stallSub?.unsubscribe();
  }

  feedSince(version: number): { version: number; events: MapFeedEvent[] } {
    return { version: this.version, events: this.feed.filter((event) => event.version > version) };
  }

  map(query: { lat: number; lng: number; lang?: string; speaks?: string }) {
    if (!Number.isFinite(query.lat) || !Number.isFinite(query.lng)) {
      throw new BadRequestException('lat and lng are required');
    }
    const lang = query.lang ?? 'en';
    this.i18n.assertCode(lang);
    if (query.speaks) this.i18n.assertCode(query.speaks);
    const cards = this.sellers
      .list()
      .filter((stall) => !query.speaks || stall.languages.includes(query.speaks))
      .map((stall) => {
        const distanceKm = roundKm(haversineKm(query.lat, query.lng, stall.lat, stall.lng));
        return {
          stallId: stall.id,
          name: this.i18n.resolve(stall.name, lang),
          tier: stall.tier,
          languages: stall.languages,
          distanceKm,
          rankScore: roundKm(distanceKm - (stall.tier === 'boosted' ? VISIBILITY_LIFT_KM : 0)),
          hasTour: stall.tour.length > 0,
          menu: stall.menu.map((item) => ({
            id: item.id,
            name: this.i18n.resolve(item.name, lang),
            priceCents: item.priceCents,
            prepMinutes: item.prepMinutes,
          })),
          skus: this.catalog.listByStall(stall.id).map((sku) => {
            const quote = this.priceFor(sku.id);
            return {
              skuId: sku.id,
              name: this.i18n.resolve(sku.name, lang),
              available: sku.available,
              priceCents: quote.priceCents,
              flashRemainingMs: quote.remainingMs ?? null,
            };
          }),
        };
      });
    cards.sort((a, b) => a.rankScore - b.rankScore || a.distanceKm - b.distanceKm);
    return { version: this.version, cards };
  }

  addWishlist(buyerId: string, skuId: string): WishlistEntry {
    this.catalog.get(skuId);
    const existing = this.wishlist.find((entry) => entry.buyerId === buyerId && entry.skuId === skuId);
    if (existing) return existing;
    const entry: WishlistEntry = { buyerId, skuId, at: this.clock.iso() };
    this.wishlist.push(entry);
    return entry;
  }

  wishlistFor(buyerId: string): WishlistEntry[] {
    return this.wishlist.filter((entry) => entry.buyerId === buyerId);
  }

  startFlash(input: { skuId: string; priceCents: number; durationMs: number }): FlashSale {
    const sku = this.catalog.get(input.skuId);
    if (input.priceCents <= 0 || input.priceCents >= sku.priceCents) {
      throw new BadRequestException('Flash price has to undercut the shelf price');
    }
    const flash: FlashSale = {
      id: this.ids.next('flash'),
      skuId: sku.id,
      priceCents: input.priceCents,
      endsAt: new Date(this.clock.now() + input.durationMs).toISOString(),
    };
    this.flashes.set(flash.id, flash);
    this.bump({ type: 'flash', stallId: sku.stallId, skuId: sku.id });
    return flash;
  }

  priceFor(skuId: string): PriceQuote {
    const sku = this.catalog.get(skuId);
    const flash = [...this.flashes.values()].find(
      (item) => item.skuId === skuId && Date.parse(item.endsAt) > this.clock.now(),
    );
    if (!flash) return { skuId, priceCents: sku.priceCents };
    return {
      skuId,
      priceCents: flash.priceCents,
      flashId: flash.id,
      endsAt: flash.endsAt,
      remainingMs: Date.parse(flash.endsAt) - this.clock.now(),
    };
  }

  startAuction(input: { skuId: string; minBidCents: number; durationMs: number }): Auction {
    const sku = this.catalog.get(input.skuId);
    if (sku.available < 1) throw new BadRequestException('Nothing left to auction');
    this.catalog.reserve(sku.id, 1, 'auction_hold');
    const auction: Auction = {
      id: this.ids.next('auc'),
      skuId: sku.id,
      minBidCents: input.minBidCents,
      highBidCents: 0,
      endsAt: new Date(this.clock.now() + input.durationMs).toISOString(),
      settled: false,
    };
    this.auctions.set(auction.id, auction);
    this.bump({ type: 'auction', stallId: sku.stallId, skuId: sku.id });
    return auction;
  }

  auction(id: string): Auction {
    const auction = this.auctions.get(id);
    if (!auction) throw new NotFoundException(`Auction ${id} not found`);
    return auction;
  }

  bid(auctionId: string, buyerId: string, amountCents: number): Auction {
    const auction = this.auction(auctionId);
    if (auction.settled || this.clock.now() >= Date.parse(auction.endsAt)) {
      throw new BadRequestException('Auction is closed');
    }
    if (amountCents < auction.minBidCents || amountCents <= auction.highBidCents) {
      throw new BadRequestException('Bid too low');
    }
    auction.highBidCents = amountCents;
    auction.highBidderId = buyerId;
    this.bump({ type: 'auction', skuId: auction.skuId });
    return auction;
  }

  markAuctionSettled(auctionId: string): Auction {
    const auction = this.auction(auctionId);
    auction.settled = true;
    return auction;
  }

  startGroup(input: { skuId: string; targetQty: number; durationMs: number }): GroupBuy {
    const sku = this.catalog.get(input.skuId);
    if (input.targetQty < 2) throw new BadRequestException('A group buy needs at least two units');
    const group: GroupBuy = {
      id: this.ids.next('grp'),
      skuId: sku.id,
      targetQty: input.targetQty,
      deadline: new Date(this.clock.now() + input.durationMs).toISOString(),
      members: [],
      settled: false,
    };
    this.groups.set(group.id, group);
    this.bump({ type: 'group', stallId: sku.stallId, skuId: sku.id });
    return group;
  }

  group(id: string): GroupBuy {
    const group = this.groups.get(id);
    if (!group) throw new NotFoundException(`Group buy ${id} not found`);
    return group;
  }

  joinGroup(groupId: string, buyerId: string, qty: number): GroupBuy {
    const group = this.group(groupId);
    if (group.settled || this.clock.now() >= Date.parse(group.deadline)) {
      throw new BadRequestException('Group buy is closed');
    }
    if (group.members.some((member) => member.buyerId === buyerId)) {
      throw new BadRequestException('Buyer is already in this group');
    }
    const joined = group.members.reduce((sum, member) => sum + member.qty, 0);
    if (qty < 1 || joined + qty > group.targetQty) {
      throw new BadRequestException('That quantity does not fit the group');
    }
    const quote = this.priceFor(group.skuId);
    this.catalog.reserve(group.skuId, qty, 'group_buy_hold');
    group.members.push({ buyerId, qty, unitCents: quote.priceCents });
    this.bump({ type: 'group', skuId: group.skuId });
    return group;
  }

  markGroupSettled(groupId: string): GroupBuy {
    const group = this.group(groupId);
    group.settled = true;
    return group;
  }

  private bump(partial: Omit<MapFeedEvent, 'version' | 'at'>): MapFeedEvent {
    this.version += 1;
    const event: MapFeedEvent = { version: this.version, at: this.clock.iso(), ...partial };
    this.feed.push(event);
    if (this.feed.length > 200) this.feed.shift();
    return event;
  }
}
