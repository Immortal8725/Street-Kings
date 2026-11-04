import { Controller, Get } from '@nestjs/common';
import { I18nService } from './i18n.service';

@Controller('languages')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  directory() {
    return this.i18n.directory();
  }
}
