import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { ChatService } from '../chat/chat.service';
import { CheckoutService } from '../checkout/checkout.service';
import { BnplService } from '../checkout/bnpl.service';
import { Clock } from '../common/clock';
import { rands } from '../common/money';
import { DeliveryService } from '../delivery/delivery.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { I18nService } from '../i18n/i18n.service';
import { REFERRAL_REWARD_CENTS } from '../sellers/seller.types';
import { SellersService } from '../sellers/sellers.service';
import { MARKET_FLOW } from './stages';

export interface FlowStep {
  phase: string;
  stage: string;
  summary: string;
  detail: unknown;
}

export interface FlowTrace {
  flow: typeof MARKET_FLOW;
  steps: FlowStep[];
  stock: { onHand: number; reserved: number; available: number };
  deliveredOrderId: string;
  referralCents: number;
  reorderId: string;
}

@Injectable()
export class MarketFlowService {
  constructor(
    private readonly clock: Clock,
    private readonly i18n: I18nService,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogService,
    private readonly discovery: DiscoveryService,
    private readonly chat: ChatService,
    private readonly checkout: CheckoutService,
    private readonly bnpl: BnplService,
    private readonly delivery: DeliveryService,
  ) {}

  describe() {
    return { flow: MARKET_FLOW };
  }

  /**
   * One in-memory pass through stall setup, discovery, chat, every sale mode,
   * runner delivery, and the post-sale reorder.
   */
  walkthrough(): FlowTrace {
    const steps: FlowStep[] = [];
    const buyer = 'buyer_lerato';
    const directory = this.i18n.directory();
    steps.push(
      this.step('languages', {
        official: directory.official.length,
        extensible: directory.extensible,
        codes: directory.official.map((lang) => lang.code),
      }),
    );

    const spice = this.sellers.open({
      sellerId: 'seller_zanele',
      name: { en: 'Ma Zanele Spice', af: 'Ma Zanele se speserye' },
      bio: { en: 'Loose spice from a table on the block.' },
      languages: ['en', 'zu', 'af'],
      lat: -26.2042,
      lng: 28.0302,
      tier: 'basic',
    });
    const kota = this.sellers.open({
      sellerId: 'seller_sbu',
      name: { en: 'Bra Sbu Kota', af: 'Bra Sbu se kota' },
      bio: { en: 'Kota and chips from the stall.', zu: 'Sawubona, woza.' },
      languages: ['en', 'zu', 'af'],
      lat: -26.214,
      lng: 28.04,
      tier: 'boosted',
      referredByCode: spice.referralCode,
    });
    this.sellers.open({
      sellerId: 'seller_far',
      name: { en: 'Harbour Snacks' },
      bio: { en: 'Too far for this map search, and English only.' },
      languages: ['en'],
      lat: -26.35,
      lng: 28.2,
      tier: 'basic',
    });
    steps.push(
      this.step('stall_setup', {
        stalls: [spice.id, kota.id],
        referralCode: spice.referralCode,
        kotaJoinedWith: spice.referralCode,
      }),
    );

    let basicBlocked = false;
    try {
      for (let i = 0; i < 4; i += 1) this.sellers.addPhoto(spice.id, `spice-${i}.jpg`);
    } catch (error) {
      basicBlocked = true;
      if (!(error instanceof Error) || !error.message.includes('Photo limit')) throw error;
    }
    if (!basicBlocked) throw new Error('Basic stall must refuse a fourth photo');
    for (let i = 0; i < 4; i += 1) this.sellers.addPhoto(kota.id, `kota-${i}.jpg`);
    const boostedInvoice = this.sellers.invoicesFor(kota.id).find((invoice) => invoice.tier === 'boosted');
    steps.push(
      this.step('subscription', {
        basicPhotoLimit: spice.photoLimit,
        basicBlockedFourthPhoto: true,
        boostedPhotoLimit: kota.photoLimit,
        boostedPhotos: this.sellers.get(kota.id).photos.length,
        boostedMonthly: rands(boostedInvoice?.cents ?? 0),
      }),
    );

    const menu = this.sellers.setMenu(kota.id, [
      { name: { en: 'Kota', af: 'Kota' }, priceCents: 4500, prepMinutes: 25 },
      { name: { en: 'Chips', af: 'Skyfies' }, priceCents: 2000, prepMinutes: 8 },
    ]);
    steps.push(this.step('menu', { items: menu.map((item) => ({ name: item.name.en, prepMinutes: item.prepMinutes })) }));

    this.sellers.addTourScene(kota.id, {
      imageKey: 'tour/counter.jpg',
      caption: { en: 'The counter', af: 'Die toonbank' },
    });
    this.sellers.addTourScene(kota.id, {
      imageKey: 'tour/grill.jpg',
      caption: { en: 'The flat-top', af: 'Die plaat' },
    });
    steps.push(this.step('tour', { scenes: this.sellers.get(kota.id).tour.length }));

    const sku = this.catalog.addSku({
      stallId: kota.id,
      name: { en: 'Chakalaka jar', af: 'Chakalaka-fles' },
      barcode: '6001234567890',
      priceCents: 4500,
      reorderAt: 21,
    });
    const supplier = this.sellers.linkSupplier(kota.id, {
      supplierName: 'Joburg Produce',
      skuId: sku.id,
      reorderQty: 24,
    });
    steps.push(this.step('supplier', { supplier: supplier.supplierName, reorderQty: supplier.reorderQty }));

    const scanned = this.catalog.applyScan('6001234567890', 30, kota.id);
    steps.push(this.step('barcode', { barcode: '6001234567890', onHand: scanned.onHand }));

    const map = this.discovery.map({ lat: -26.204, lng: 28.03, lang: 'af', speaks: 'zu' });
    if (map.cards[0]?.stallId !== kota.id) {
      throw new Error(`Boosted stall should rank first, got ${map.cards.map((card) => card.name).join(', ')}`);
    }
    if (map.cards.length !== 2 || map.cards[0].name !== 'Bra Sbu se kota') {
      throw new Error('Map should resolve Afrikaans copy and hide the English-only stall');
    }
    steps.push(
      this.step('map', {
        version: map.version,
        top: map.cards[0].name,
        rank: map.cards.map((card) => ({ name: card.name, tier: card.tier, rankScore: card.rankScore })),
      }),
    );

    this.discovery.addWishlist(buyer, sku.id);
    steps.push(this.step('wishlist', { buyer, skuId: sku.id, saved: this.discovery.wishlistFor(buyer).length }));

    const flash = this.discovery.startFlash({ skuId: sku.id, priceCents: 3200, durationMs: 15 * 60 * 1000 });
    const quote = this.discovery.priceFor(sku.id);
    if (!quote.remainingMs || quote.remainingMs <= 0) throw new Error('Flash countdown should be running');
    steps.push(
      this.step('flash', { price: rands(flash.priceCents), remainingMs: quote.remainingMs, shelf: rands(4500) }),
    );

    const thread = this.chat.open({ buyerId: buyer, stallId: kota.id });
    const text = this.chat.postText(thread.id, {
      fromId: buyer,
      lang: 'en',
      text: 'Sawubona — is the chakalaka still on the table?',
    });
    steps.push(this.step('chat', { threadId: thread.id, tick: text.tick, lang: text.lang }));

    const voice = this.chat.postVoice(thread.id, {
      fromId: 'seller_sbu',
      lang: 'zu',
      durationMs: 4200,
      transcript: 'Yebo, sikhona.',
    });
    this.chat.markDelivered(thread.id);
    this.chat.markRead(thread.id, buyer);
    const readVoice = this.chat.get(thread.id).messages.find((message) => message.id === voice.id);
    steps.push(
      this.step('voice', {
        storageKey: voice.voice?.storageKey,
        durationMs: voice.voice?.durationMs,
        tick: readVoice?.tick,
      }),
    );

    const kotaItem = menu[0];
    const paid = this.checkout.place({
      buyerId: buyer,
      stallId: kota.id,
      payMethod: 'pay_now',
      fulfillment: 'runner',
      skuLines: [{ skuId: sku.id, qty: 1 }],
      menuLines: [{ menuItemId: kotaItem.id, qty: 1 }],
    });
    if (paid.lines[0].unitCents !== 3200 || paid.prepMinutes !== 25) {
      throw new Error('Checkout should use the flash price and the kota prep time');
    }
    steps.push(
      this.step('checkout', {
        orderId: paid.id,
        total: rands(paid.totalCents),
        prepMinutes: paid.prepMinutes,
        status: paid.status,
      }),
    );

    const saleTick = [...this.catalog.ticks()].reverse().find((tick) => tick.reason === 'sale');
    const feed = this.discovery.feedSince(0);
    if (!saleTick || !feed.events.some((event) => event.type === 'stock')) {
      throw new Error('Sale should tick stock onto the map feed');
    }
    steps.push(
      this.step('inventory_tick', { available: saleTick.available, reason: saleTick.reason, feedVersion: feed.version }),
    );

    const layaway = this.checkout.place({
      buyerId: 'buyer_thandi',
      stallId: kota.id,
      payMethod: 'layaway',
      fulfillment: 'pickup',
      layawayCount: 3,
      skuLines: [{ skuId: sku.id, qty: 2 }],
    });
    this.checkout.payLayaway(layaway.id);
    const settledLayaway = this.checkout.payLayaway(layaway.id);
    steps.push(
      this.step('layaway', {
        orderId: settledLayaway.id,
        status: settledLayaway.status,
        paid: `${settledLayaway.layaway?.paidCount}/${settledLayaway.layaway?.count}`,
        installment: rands(settledLayaway.layaway?.installmentCents ?? 0),
      }),
    );

    const declined = this.bnpl.quote('payflex', 5_000_000);
    const bnplOrder = this.checkout.place({
      buyerId: 'buyer_pieter',
      stallId: kota.id,
      payMethod: 'bnpl',
      fulfillment: 'pickup',
      bnplPartner: 'payjustnow',
      skuLines: [{ skuId: sku.id, qty: 1 }],
    });
    steps.push(
      this.step('bnpl', {
        declined: declined.approved ? 'no' : declined.reason,
        partner: bnplOrder.bnpl?.partner,
        reference: bnplOrder.bnpl?.reference,
        mode: 'sandbox',
      }),
    );

    const group = this.discovery.startGroup({ skuId: sku.id, targetQty: 4, durationMs: 60 * 60 * 1000 });
    this.discovery.joinGroup(group.id, 'buyer_a', 2);
    this.discovery.joinGroup(group.id, 'buyer_b', 2);
    const grouped = this.checkout.settleGroup(group.id);
    steps.push(
      this.step('group_buy', { groupId: group.id, targetQty: group.targetQty, orders: grouped.length }),
    );

    const auction = this.discovery.startAuction({ skuId: sku.id, minBidCents: 2000, durationMs: 60_000 });
    this.discovery.bid(auction.id, 'buyer_rare', 5000);
    this.clock.advance(61_000);
    const won = this.checkout.settleAuction(auction.id);
    steps.push(this.step('auction', { winner: won.buyerId, bid: rands(won.totalCents), status: won.status }));

    let job = this.delivery.dispatch(paid.id);
    job = this.delivery.advance(job.id);
    job = this.delivery.advance(job.id);
    job = this.delivery.advance(job.id);
    const delivered = this.checkout.get(paid.id);
    if (delivered.status !== 'delivered' || job.runnerId !== 'runner_ayesha' || job.etaMinutes < 25) {
      throw new Error(`Runner handoff failed: ${job.runnerId} eta ${job.etaMinutes} status ${delivered.status}`);
    }
    steps.push(
      this.step('delivery', {
        runner: job.runnerName,
        etaMinutes: job.etaMinutes,
        prepMinutes: job.prepMinutes,
        status: delivered.status,
      }),
    );

    const credits = this.sellers.creditsFor(spice.id);
    const reward = credits.reduce((sum, credit) => sum + credit.cents, 0);
    if (reward !== REFERRAL_REWARD_CENTS) throw new Error('Referral reward missing');
    steps.push(this.step('referral', { referrer: spice.id, reward: rands(reward), newStall: kota.id }));

    const finalStock = this.catalog.get(sku.id);
    if (finalStock.available !== 21 || finalStock.reserved !== 0) {
      throw new Error(`Expected 21 available and nothing reserved, got ${finalStock.available}/${finalStock.reserved}`);
    }
    const drafts = this.replenish(kota.id);
    if (!drafts.length) throw new Error('Low stock should draft a supplier reorder');
    steps.push(
      this.step('reorder', {
        available: finalStock.available,
        reorderAt: finalStock.reorderAt,
        supplier: supplier.supplierName,
        qty: drafts[0].qty,
      }),
    );

    const expected = MARKET_FLOW.map((stage) => stage.stage).join('>');
    const actual = steps.map((step) => step.stage).join('>');
    if (expected !== actual) throw new Error(`Flow drift: ${actual}`);

    return {
      flow: MARKET_FLOW,
      steps,
      stock: { onHand: finalStock.onHand, reserved: finalStock.reserved, available: finalStock.available },
      deliveredOrderId: delivered.id,
      referralCents: reward,
      reorderId: drafts[0].id,
    };
  }

  replenish(stallId: string) {
    const stall = this.sellers.get(stallId);
    const drafts = [];
    for (const link of stall.suppliers) {
      if (!link.skuId) continue;
      const sku = this.catalog.get(link.skuId);
      if (sku.available > sku.reorderAt) continue;
      drafts.push(
        this.sellers.recordReorder({
          stallId,
          supplierLinkId: link.id,
          skuId: sku.id,
          qty: link.reorderQty,
          reason: `available ${sku.available} at or below reorder point ${sku.reorderAt}`,
        }),
      );
    }
    return drafts;
  }

  private step(stage: string, detail: unknown): FlowStep {
    const defined = MARKET_FLOW.find((item) => item.stage === stage);
    if (!defined) throw new Error(`Unknown stage ${stage}`);
    return { phase: defined.phase, stage, summary: defined.summary, detail };
  }
}
