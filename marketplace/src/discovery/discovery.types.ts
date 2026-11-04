export interface FlashSale {
  id: string;
  skuId: string;
  priceCents: number;
  endsAt: string;
}

export interface Auction {
  id: string;
  skuId: string;
  minBidCents: number;
  highBidCents: number;
  highBidderId?: string;
  endsAt: string;
  settled: boolean;
}

export interface GroupMember {
  buyerId: string;
  qty: number;
  unitCents: number;
}

export interface GroupBuy {
  id: string;
  skuId: string;
  targetQty: number;
  deadline: string;
  members: GroupMember[];
  settled: boolean;
}

export interface WishlistEntry {
  buyerId: string;
  skuId: string;
  at: string;
}

export interface PriceQuote {
  skuId: string;
  priceCents: number;
  flashId?: string;
  endsAt?: string;
  remainingMs?: number;
}

export interface MapFeedEvent {
  version: number;
  type: 'stall' | 'stock' | 'flash' | 'auction' | 'group';
  stallId?: string;
  skuId?: string;
  at: string;
}
