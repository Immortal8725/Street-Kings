import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Clock } from '../common/clock';
import { IdFactory } from '../common/ids';
import { I18nService } from '../i18n/i18n.service';
import { LocalizedText } from '../i18n/languages';
import { SellersService } from '../sellers/sellers.service';
import { Sku, SkuView, StockTick } from './catalog.types';
import { StockTicker } from './stock-ticker';

export interface AddSkuInput {
  stallId: string;
  name: LocalizedText;
  barcode?: string;
  priceCents: number;
  reorderAt: number;
  stock?: number;
}

@Injectable()
export class CatalogService {
  private readonly skus = new Map<string, Sku>();
  private readonly history: StockTick[] = [];

  constructor(
    private readonly ids: IdFactory,
    private readonly clock: Clock,
    private readonly i18n: I18nService,
    private readonly sellers: SellersService,
    private readonly ticker: StockTicker,
  ) {}

  ticks(): StockTick[] {
    return [...this.history];
  }

  view(sku: Sku): SkuView {
    return { ...sku, available: sku.onHand - sku.reserved };
  }

  get(id: string): SkuView {
    const sku = this.skus.get(id);
    if (!sku) throw new NotFoundException(`SKU ${id} not found`);
    return this.view(sku);
  }

  listByStall(stallId: string): SkuView[] {
    return [...this.skus.values()].filter((sku) => sku.stallId === stallId).map((sku) => this.view(sku));
  }

  addSku(input: AddSkuInput): SkuView {
    this.sellers.get(input.stallId);
    this.i18n.assertLocalized(input.name);
    if (input.priceCents < 0) throw new BadRequestException('Price cannot be negative');
    const sku: Sku = {
      id: this.ids.next('sku'),
      stallId: input.stallId,
      name: input.name,
      barcode: input.barcode,
      onHand: 0,
      reserved: 0,
      priceCents: input.priceCents,
      reorderAt: input.reorderAt,
    };
    this.skus.set(sku.id, sku);
    if (input.stock) this.apply(sku, input.stock, 0, 'opening_stock');
    return this.view(sku);
  }

  applyScan(barcode: string, delta: number, stallId?: string): SkuView {
    const sku = [...this.skus.values()].find(
      (item) => item.barcode === barcode && (!stallId || item.stallId === stallId),
    );
    if (!sku) throw new NotFoundException(`Unknown barcode ${barcode}`);
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Scan delta must be a non-zero integer');
    }
    this.apply(sku, delta, 0, 'barcode_scan');
    return this.view(sku);
  }

  commitSale(skuId: string, qty: number, reason: string): StockTick {
    return this.apply(this.must(skuId), -qty, 0, reason);
  }

  reserve(skuId: string, qty: number, reason: string): StockTick {
    return this.apply(this.must(skuId), 0, qty, reason);
  }

  commitReserved(skuId: string, qty: number, reason: string): StockTick {
    return this.apply(this.must(skuId), -qty, -qty, reason);
  }

  private must(id: string): Sku {
    const sku = this.skus.get(id);
    if (!sku) throw new NotFoundException(`SKU ${id} not found`);
    return sku;
  }

  private apply(sku: Sku, deltaOnHand: number, deltaReserved: number, reason: string): StockTick {
    if (!Number.isInteger(deltaOnHand) || !Number.isInteger(deltaReserved)) {
      throw new BadRequestException('Stock changes must be whole units');
    }
    const onHand = sku.onHand + deltaOnHand;
    const reserved = sku.reserved + deltaReserved;
    if (onHand < 0 || reserved < 0 || reserved > onHand) {
      throw new BadRequestException('Not enough stock');
    }
    sku.onHand = onHand;
    sku.reserved = reserved;
    const tick: StockTick = {
      skuId: sku.id,
      stallId: sku.stallId,
      onHand,
      reserved,
      available: onHand - reserved,
      reason,
      at: this.clock.iso(),
    };
    this.history.push(tick);
    this.ticker.emit(tick);
    return tick;
  }
}
