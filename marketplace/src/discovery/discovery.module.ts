import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SellersModule } from '../sellers/sellers.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [CatalogModule, SellersModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
