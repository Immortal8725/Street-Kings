import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LocalizedText } from '../i18n/languages';
import { OpenStallInput, SellersService } from './sellers.service';
import { StallTier } from './seller.types';

@Controller('stalls')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  list() {
    return this.sellers.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sellers.get(id);
  }

  @Post()
  open(@Body() body: OpenStallInput) {
    return this.sellers.open(body);
  }

  @Post(':id/tier')
  setTier(@Param('id') id: string, @Body() body: { tier: StallTier }) {
    return this.sellers.setTier(id, body.tier);
  }

  @Post(':id/photos')
  addPhoto(@Param('id') id: string, @Body() body: { key: string }) {
    return this.sellers.addPhoto(id, body.key);
  }

  @Post(':id/menu')
  setMenu(
    @Param('id') id: string,
    @Body() body: { items: { name: LocalizedText; priceCents: number; prepMinutes: number }[] },
  ) {
    return this.sellers.setMenu(id, body.items);
  }

  @Post(':id/tour')
  addTour(@Param('id') id: string, @Body() body: { imageKey: string; caption: LocalizedText }) {
    return this.sellers.addTourScene(id, body);
  }

  @Post(':id/suppliers')
  linkSupplier(
    @Param('id') id: string,
    @Body() body: { supplierName: string; skuId?: string; reorderQty: number },
  ) {
    return this.sellers.linkSupplier(id, body);
  }

  @Post(':id/move')
  move(@Param('id') id: string, @Body() body: { lat: number; lng: number }) {
    return this.sellers.relocate(id, body.lat, body.lng);
  }
}
