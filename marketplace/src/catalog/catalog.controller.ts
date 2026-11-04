import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AddSkuInput, CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('skus')
  add(@Body() body: AddSkuInput) {
    return this.catalog.addSku(body);
  }

  @Get('skus/:id')
  get(@Param('id') id: string) {
    return this.catalog.get(id);
  }

  @Get('ticks')
  ticks() {
    return this.catalog.ticks();
  }

  @Post('scan')
  scan(@Body() body: { barcode: string; delta: number; stallId?: string }) {
    return this.catalog.applyScan(body.barcode, body.delta, body.stallId);
  }
}
