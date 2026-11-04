import { LocalizedText } from '../i18n/languages';

export interface Sku {
  id: string;
  stallId: string;
  name: LocalizedText;
  barcode?: string;
  onHand: number;
  reserved: number;
  priceCents: number;
  reorderAt: number;
}

export interface StockTick {
  skuId: string;
  stallId: string;
  onHand: number;
  reserved: number;
  available: number;
  reason: string;
  at: string;
}

export interface SkuView extends Sku {
  available: number;
}
