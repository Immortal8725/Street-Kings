import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { StockTick } from './catalog.types';

@Injectable()
export class StockTicker {
  private readonly events = new Subject<StockTick>();
  readonly ticks$ = this.events.asObservable();

  emit(tick: StockTick): void {
    this.events.next(tick);
  }
}
