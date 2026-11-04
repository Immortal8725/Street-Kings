import { Global, Module } from '@nestjs/common';
import { Clock } from './clock';
import { IdFactory } from './ids';

@Global()
@Module({
  providers: [Clock, IdFactory],
  exports: [Clock, IdFactory],
})
export class CommonModule {}
