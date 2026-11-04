import { Injectable } from '@nestjs/common';

@Injectable()
export class Clock {
  private offsetMs = 0;

  now(): number {
    return Date.now() + this.offsetMs;
  }

  iso(): string {
    return new Date(this.now()).toISOString();
  }

  advance(ms: number): number {
    this.offsetMs += ms;
    return this.now();
  }
}
