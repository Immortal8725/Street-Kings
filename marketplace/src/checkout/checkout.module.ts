import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { SellersModule } from '../sellers/sellers.module';
import { BnplService } from './bnpl.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [CatalogModule, DiscoveryModule, SellersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, BnplService],
  exports: [CheckoutService, BnplService],
})
export class CheckoutModule {}
