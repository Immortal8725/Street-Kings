import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

@Controller()
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('map')
  map(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('lang') lang?: string,
    @Query('speaks') speaks?: string,
  ) {
    return this.discovery.map({ lat: Number(lat), lng: Number(lng), lang, speaks });
  }

  @Get('map/feed')
  feed(@Query('since') since?: string) {
    return this.discovery.feedSince(Number(since ?? 0));
  }

  @Post('discovery/wishlist')
  wishlist(@Body() body: { buyerId: string; skuId: string }) {
    return this.discovery.addWishlist(body.buyerId, body.skuId);
  }

  @Post('discovery/flash')
  flash(@Body() body: { skuId: string; priceCents: number; durationMs: number }) {
    return this.discovery.startFlash(body);
  }

  @Post('discovery/auctions')
  openAuction(@Body() body: { skuId: string; minBidCents: number; durationMs: number }) {
    return this.discovery.startAuction(body);
  }

  @Post('discovery/auctions/:id/bids')
  bid(@Param('id') id: string, @Body() body: { buyerId: string; amountCents: number }) {
    return this.discovery.bid(id, body.buyerId, body.amountCents);
  }

  @Post('discovery/groups')
  openGroup(@Body() body: { skuId: string; targetQty: number; durationMs: number }) {
    return this.discovery.startGroup(body);
  }

  @Post('discovery/groups/:id/join')
  join(@Param('id') id: string, @Body() body: { buyerId: string; qty: number }) {
    return this.discovery.joinGroup(id, body.buyerId, body.qty);
  }
}
