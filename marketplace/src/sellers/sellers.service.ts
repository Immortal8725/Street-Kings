import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Clock } from '../common/clock';
import { IdFactory } from '../common/ids';
import { I18nService } from '../i18n/i18n.service';
import { LocalizedText } from '../i18n/languages';
import {
  MenuItem,
  REFERRAL_REWARD_CENTS,
  ReferralCredit,
  ReorderDraft,
  Stall,
  StallTier,
  SupplierLink,
  TIER_MONTHLY_CENTS,
  TIER_PHOTO_LIMIT,
  TierInvoice,
  TourScene,
} from './seller.types';
import { StallEvents } from './stall-events';

export interface OpenStallInput {
  sellerId: string;
  name: LocalizedText;
  bio: LocalizedText;
  languages: string[];
  lat: number;
  lng: number;
  tier?: StallTier;
  referredByCode?: string;
}

@Injectable()
export class SellersService {
  private readonly stalls = new Map<string, Stall>();
  private readonly credits: ReferralCredit[] = [];
  private readonly invoices: TierInvoice[] = [];
  private readonly reorders: ReorderDraft[] = [];

  constructor(
    private readonly ids: IdFactory,
    private readonly clock: Clock,
    private readonly i18n: I18nService,
    private readonly events: StallEvents,
  ) {}

  list(): Stall[] {
    return [...this.stalls.values()];
  }

  get(id: string): Stall {
    const stall = this.stalls.get(id);
    if (!stall) throw new NotFoundException(`Stall ${id} not found`);
    return stall;
  }

  creditsFor(stallId: string): ReferralCredit[] {
    return this.credits.filter((credit) => credit.referrerStallId === stallId);
  }

  invoicesFor(stallId: string): TierInvoice[] {
    return this.invoices.filter((invoice) => invoice.stallId === stallId);
  }

  reordersFor(stallId: string): ReorderDraft[] {
    return this.reorders.filter((draft) => draft.stallId === stallId);
  }

  open(input: OpenStallInput): Stall {
    this.i18n.assertLocalized(input.name);
    this.i18n.assertLocalized(input.bio);
    if (!input.languages.length) throw new BadRequestException('Pick at least one language');
    for (const code of input.languages) this.i18n.assertCode(code);
    if (!input.languages.includes('en')) {
      throw new BadRequestException('Stalls include English so buyers have a fallback');
    }
    const tier = input.tier ?? 'basic';
    const stall: Stall = {
      id: this.ids.next('stall'),
      sellerId: input.sellerId,
      name: input.name,
      bio: input.bio,
      languages: [...input.languages],
      lat: input.lat,
      lng: input.lng,
      tier,
      photoLimit: TIER_PHOTO_LIMIT[tier],
      photos: [],
      tour: [],
      menu: [],
      suppliers: [],
      referralCode: this.makeCode(input.name.en),
      createdAt: this.clock.iso(),
    };
    if (input.referredByCode) {
      const referrer = [...this.stalls.values()].find((item) => item.referralCode === input.referredByCode);
      if (!referrer) throw new NotFoundException('Referral code not found');
      stall.referredByStallId = referrer.id;
      this.credits.push({
        id: this.ids.next('ref'),
        referrerStallId: referrer.id,
        newStallId: stall.id,
        cents: REFERRAL_REWARD_CENTS,
        createdAt: this.clock.iso(),
      });
    }
    this.stalls.set(stall.id, stall);
    this.recordInvoice(stall);
    this.events.emit({ type: 'opened', stallId: stall.id });
    return stall;
  }

  setTier(stallId: string, tier: StallTier): Stall {
    const stall = this.get(stallId);
    if (tier === 'basic' && stall.photos.length > TIER_PHOTO_LIMIT.basic) {
      throw new BadRequestException('Remove photos before dropping to the basic stall');
    }
    stall.tier = tier;
    stall.photoLimit = TIER_PHOTO_LIMIT[tier];
    this.recordInvoice(stall);
    this.events.emit({ type: 'tier', stallId });
    return stall;
  }

  addPhoto(stallId: string, key: string): Stall {
    const stall = this.get(stallId);
    if (stall.photos.length >= stall.photoLimit) {
      throw new BadRequestException(`Photo limit ${stall.photoLimit} for the ${stall.tier} stall`);
    }
    stall.photos.push({ key });
    this.events.emit({ type: 'photo', stallId });
    return stall;
  }

  setMenu(
    stallId: string,
    items: { name: LocalizedText; priceCents: number; prepMinutes: number }[],
  ): MenuItem[] {
    const stall = this.get(stallId);
    stall.menu = items.map((item) => {
      this.i18n.assertLocalized(item.name);
      if (item.prepMinutes < 0) throw new BadRequestException('Prep time cannot be negative');
      return {
        id: this.ids.next('menu'),
        name: item.name,
        priceCents: item.priceCents,
        prepMinutes: item.prepMinutes,
      };
    });
    this.events.emit({ type: 'menu', stallId });
    return stall.menu;
  }

  addTourScene(stallId: string, input: { imageKey: string; caption: LocalizedText }): TourScene {
    const stall = this.get(stallId);
    this.i18n.assertLocalized(input.caption);
    const scene: TourScene = {
      id: this.ids.next('scene'),
      imageKey: input.imageKey,
      caption: input.caption,
    };
    stall.tour.push(scene);
    this.events.emit({ type: 'tour', stallId });
    return scene;
  }

  linkSupplier(
    stallId: string,
    input: { supplierName: string; skuId?: string; reorderQty: number },
  ): SupplierLink {
    const stall = this.get(stallId);
    if (input.reorderQty <= 0) throw new BadRequestException('Reorder quantity must be positive');
    const link: SupplierLink = {
      id: this.ids.next('sup'),
      supplierName: input.supplierName,
      skuId: input.skuId,
      reorderQty: input.reorderQty,
    };
    stall.suppliers.push(link);
    return link;
  }

  recordReorder(input: {
    stallId: string;
    supplierLinkId: string;
    skuId: string;
    qty: number;
    reason: string;
  }): ReorderDraft {
    const draft: ReorderDraft = {
      id: this.ids.next('po'),
      stallId: input.stallId,
      supplierLinkId: input.supplierLinkId,
      skuId: input.skuId,
      qty: input.qty,
      reason: input.reason,
      createdAt: this.clock.iso(),
    };
    this.reorders.push(draft);
    return draft;
  }

  relocate(stallId: string, lat: number, lng: number): Stall {
    const stall = this.get(stallId);
    stall.lat = lat;
    stall.lng = lng;
    this.events.emit({ type: 'moved', stallId });
    return stall;
  }

  private recordInvoice(stall: Stall): TierInvoice {
    const invoice: TierInvoice = {
      id: this.ids.next('sub'),
      stallId: stall.id,
      tier: stall.tier,
      cents: TIER_MONTHLY_CENTS[stall.tier],
      mode: 'sandbox',
      createdAt: this.clock.iso(),
    };
    this.invoices.push(invoice);
    return invoice;
  }

  private makeCode(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'stall';
    return `${slug}-${this.ids.next('code').split('_')[1]}`;
  }
}
