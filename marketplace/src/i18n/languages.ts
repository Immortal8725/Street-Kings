export interface LanguageOption {
  code: string;
  endonym: string;
  englishName: string;
  official: boolean;
}

/** Twelve official languages. Any other short language tag is accepted on a stall. */
export const OFFICIAL_SA_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', endonym: 'English', englishName: 'English', official: true },
  { code: 'af', endonym: 'Afrikaans', englishName: 'Afrikaans', official: true },
  { code: 'nr', endonym: 'isiNdebele', englishName: 'isiNdebele', official: true },
  { code: 'xh', endonym: 'isiXhosa', englishName: 'isiXhosa', official: true },
  { code: 'zu', endonym: 'isiZulu', englishName: 'isiZulu', official: true },
  { code: 'nso', endonym: 'Sepedi', englishName: 'Sepedi', official: true },
  { code: 'st', endonym: 'Sesotho', englishName: 'Sesotho', official: true },
  { code: 'tn', endonym: 'Setswana', englishName: 'Setswana', official: true },
  { code: 'ss', endonym: 'siSwati', englishName: 'siSwati', official: true },
  { code: 've', endonym: 'Tshivenḓa', englishName: 'Tshivenda', official: true },
  { code: 'ts', endonym: 'Xitsonga', englishName: 'Xitsonga', official: true },
  {
    code: 'sasl',
    endonym: 'South African Sign Language',
    englishName: 'South African Sign Language',
    official: true,
  },
];

export type LocalizedText = { en: string } & Record<string, string>;
