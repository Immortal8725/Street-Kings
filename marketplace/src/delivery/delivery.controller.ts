import { Controller, Get, Param, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller()
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('runners')
  runners() {
    return this.delivery.listRunners();
  }

  @Post('orders/:orderId/dispatch')
  dispatch(@Param('orderId') orderId: string) {
    return this.delivery.dispatch(orderId);
  }

  @Post('deliveries/:id/advance')
  advance(@Param('id') id: string) {
    return this.delivery.advance(id);
  }
}
