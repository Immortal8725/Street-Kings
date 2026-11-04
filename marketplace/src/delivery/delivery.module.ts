import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { SellersModule } from '../sellers/sellers.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [CheckoutModule, SellersModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
