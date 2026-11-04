import { LocalizedText } from '../i18n/languages';

export type StallTier = 'basic' | 'boosted';

export interface StallPhoto {
  key: string;
}

export interface TourScene {
  id: string;
  imageKey: string;
  caption: LocalizedText;
}

export interface MenuItem {
  id: string;
  name: LocalizedText;
  priceCents: number;
  prepMinutes: number;
}

export interface SupplierLink {
  id: string;
  supplierName: string;
  skuId?: string;
  reorderQty: number;
}

export interface ReorderDraft {
  id: string;
  stallId: string;
  supplierLinkId: string;
  skuId: string;
  qty: number;
  reason: string;
  createdAt: string;
}

export interface ReferralCredit {
  id: string;
  referrerStallId: string;
  newStallId: string;
  cents: number;
  createdAt: string;
}

export interface TierInvoice {
  id: string;
  stallId: string;
  tier: StallTier;
  cents: number;
  mode: 'sandbox';
  createdAt: string;
}

export interface Stall {
  id: string;
  sellerId: string;
  name: LocalizedText;
  bio: LocalizedText;
  languages: string[];
  lat: number;
  lng: number;
  tier: StallTier;
  photoLimit: number;
  photos: StallPhoto[];
  tour: TourScene[];
  menu: MenuItem[];
  suppliers: SupplierLink[];
  referralCode: string;
  referredByStallId?: string;
  createdAt: string;
}

export interface StallEvent {
  type: 'opened' | 'tier' | 'moved' | 'menu' | 'tour' | 'photo';
  stallId: string;
}

export const TIER_PHOTO_LIMIT: Record<StallTier, number> = {
  basic: 3,
  boosted: 12,
};

export const TIER_MONTHLY_CENTS: Record<StallTier, number> = {
  basic: 0,
  boosted: 14900,
};

export const REFERRAL_REWARD_CENTS = 2500;
