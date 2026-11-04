import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BnplService } from './bnpl.service';
import { CheckoutService } from './checkout.service';
import { PlaceOrderInput } from './checkout.types';

@Controller()
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly bnpl: BnplService,
  ) {}

  @Get('bnpl/partners')
  partners() {
    return this.bnpl.partners();
  }

  @Post('bnpl/quote')
  quote(@Body() body: { partner: string; totalCents: number }) {
    return this.bnpl.quote(body.partner, body.totalCents);
  }

  @Post('orders')
  place(@Body() body: PlaceOrderInput) {
    return this.checkout.place(body);
  }

  @Get('orders/:id')
  get(@Param('id') id: string) {
    return this.checkout.get(id);
  }

  @Post('orders/:id/layaway')
  payLayaway(@Param('id') id: string) {
    return this.checkout.payLayaway(id);
  }

  @Post('groups/:id/settle')
  settleGroup(@Param('id') id: string) {
    return this.checkout.settleGroup(id);
  }

  @Post('auctions/:id/settle')
  settleAuction(@Param('id') id: string) {
    return this.checkout.settleAuction(id);
  }
}
