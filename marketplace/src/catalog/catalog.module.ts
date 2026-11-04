import { Module } from '@nestjs/common';
import { SellersModule } from '../sellers/sellers.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { StockTicker } from './stock-ticker';

@Module({
  imports: [SellersModule],
  controllers: [CatalogController],
  providers: [CatalogService, StockTicker],
  exports: [CatalogService, StockTicker],
})
export class CatalogModule {}
