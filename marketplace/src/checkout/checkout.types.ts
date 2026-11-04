export type PayMethod = 'pay_now' | 'layaway' | 'bnpl';
export type Fulfillment = 'pickup' | 'runner';
export type OrderStatus =
  | 'reserved'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderLine {
  skuId?: string;
  menuItemId?: string;
  name: string;
  qty: number;
  unitCents: number;
}

export interface LayawayPlan {
  count: number;
  paidCount: number;
  installmentCents: number;
}

export interface BnplPlan {
  partner: string;
  reference: string;
  installmentCount: number;
  installmentCents: number;
  mode: 'sandbox';
}

export interface Order {
  id: string;
  buyerId: string;
  stallId: string;
  lines: OrderLine[];
  totalCents: number;
  payMethod: PayMethod;
  fulfillment: Fulfillment;
  status: OrderStatus;
  layaway?: LayawayPlan;
  bnpl?: BnplPlan;
  prepMinutes: number;
  createdAt: string;
}

export interface SkuLineInput {
  skuId: string;
  qty: number;
  unitPriceOverrideCents?: number;
}

export interface MenuLineInput {
  menuItemId: string;
  qty: number;
}

export interface PlaceOrderInput {
  buyerId: string;
  stallId: string;
  payMethod: PayMethod;
  fulfillment: Fulfillment;
  skuLines?: SkuLineInput[];
  menuLines?: MenuLineInput[];
  layawayCount?: number;
  bnplPartner?: string;
}
