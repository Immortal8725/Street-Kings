import { Injectable } from '@nestjs/common';

@Injectable()
export class IdFactory {
  private n = 0;

  next(prefix: string): string {
    this.n += 1;
    return `${prefix}_${this.n.toString(36)}`;
  }
}
