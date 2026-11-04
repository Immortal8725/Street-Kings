import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { StallEvents } from './stall-events';

@Module({
  controllers: [SellersController],
  providers: [SellersService, StallEvents],
  exports: [SellersService, StallEvents],
})
export class SellersModule {}
