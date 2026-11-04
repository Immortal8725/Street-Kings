import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { ChatModule } from './chat/chat.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CommonModule } from './common/common.module';
import { DeliveryModule } from './delivery/delivery.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { FlowModule } from './flow/flow.module';
import { I18nModule } from './i18n/i18n.module';
import { SellersModule } from './sellers/sellers.module';

@Module({
  imports: [
    CommonModule,
    I18nModule,
    SellersModule,
    CatalogModule,
    DiscoveryModule,
    ChatModule,
    CheckoutModule,
    DeliveryModule,
    FlowModule,
  ],
})
export class AppModule {}
