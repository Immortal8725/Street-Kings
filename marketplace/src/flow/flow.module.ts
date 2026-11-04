import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ChatModule } from '../chat/chat.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { SellersModule } from '../sellers/sellers.module';
import { FlowController } from './flow.controller';
import { MarketFlowService } from './market-flow.service';

@Module({
  imports: [SellersModule, CatalogModule, DiscoveryModule, ChatModule, CheckoutModule, DeliveryModule],
  controllers: [FlowController],
  providers: [MarketFlowService],
  exports: [MarketFlowService],
})
export class FlowModule {}
