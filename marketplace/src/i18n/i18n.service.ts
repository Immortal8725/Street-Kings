import { BadRequestException, Injectable } from '@nestjs/common';
import { LanguageOption, LocalizedText, OFFICIAL_SA_LANGUAGES } from './languages';

const EXTRA_TAG = /^[a-z]{2,8}(-[a-z0-9]{2,8})?$/;

@Injectable()
export class I18nService {
  private readonly official = new Map(OFFICIAL_SA_LANGUAGES.map((lang) => [lang.code, lang]));

  directory(): { official: LanguageOption[]; extensible: true } {
    return { official: [...OFFICIAL_SA_LANGUAGES], extensible: true };
  }

  assertCode(code: string): void {
    if (this.official.has(code) || EXTRA_TAG.test(code)) return;
    throw new BadRequestException(`Unsupported language tag ${code}`);
  }

  assertLocalized(text: LocalizedText): void {
    if (!text.en?.trim()) {
      throw new BadRequestException('English copy is required as the fallback');
    }
    for (const code of Object.keys(text)) this.assertCode(code);
  }

  resolve(text: LocalizedText, lang = 'en'): string {
    this.assertCode(lang);
    return text[lang] || text.en;
  }
}
