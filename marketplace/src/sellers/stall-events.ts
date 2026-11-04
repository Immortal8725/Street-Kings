import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { StallEvent } from './seller.types';

@Injectable()
export class StallEvents {
  private readonly events = new Subject<StallEvent>();
  readonly stream$ = this.events.asObservable();

  emit(event: StallEvent): void {
    this.events.next(event);
  }
}
