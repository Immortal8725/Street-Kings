import { Controller, Get, Post } from '@nestjs/common';
import { MarketFlowService } from './market-flow.service';

@Controller('flow')
export class FlowController {
  constructor(private readonly flow: MarketFlowService) {}

  @Get()
  describe() {
    return this.flow.describe();
  }

  @Post('walkthrough')
  walkthrough() {
    return this.flow.walkthrough();
  }
}
