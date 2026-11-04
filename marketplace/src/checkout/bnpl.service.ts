import { BadRequestException, Injectable } from '@nestjs/common';
import { IdFactory } from '../common/ids';

export interface BnplQuote {
  partner: string;
  approved: boolean;
  reason?: string;
  reference?: string;
  installmentCount?: number;
  installmentCents?: number;
  mode: 'sandbox';
}

interface Partner {
  code: string;
  label: string;
  maxCents: number;
  installments: number;
}

const PARTNERS: readonly Partner[] = [
  { code: 'payflex', label: 'Payflex', maxCents: 2_000_000, installments: 4 },
  { code: 'payjustnow', label: 'PayJustNow', maxCents: 1_500_000, installments: 3 },
  { code: 'mobicred', label: 'Mobicred', maxCents: 3_000_000, installments: 6 },
];

@Injectable()
export class BnplService {
  constructor(private readonly ids: IdFactory) {}

  partners(): { code: string; label: string; installments: number; mode: 'sandbox' }[] {
    return PARTNERS.map(({ code, label, installments }) => ({
      code,
      label,
      installments,
      mode: 'sandbox',
    }));
  }

  quote(partnerCode: string | undefined, totalCents: number): BnplQuote {
    const partner = PARTNERS.find((item) => item.code === partnerCode);
    if (!partner) {
      return { partner: partnerCode ?? '', approved: false, reason: 'Unknown BNPL partner', mode: 'sandbox' };
    }
    if (totalCents > partner.maxCents) {
      return {
        partner: partner.code,
        approved: false,
        reason: `${partner.label} sandbox limit is ${partner.maxCents} cents`,
        mode: 'sandbox',
      };
    }
    return {
      partner: partner.code,
      approved: true,
      reference: `sandbox_${partner.code}_${this.ids.next('bnpl')}`,
      installmentCount: partner.installments,
      installmentCents: Math.ceil(totalCents / partner.installments),
      mode: 'sandbox',
    };
  }

  requireQuote(partnerCode: string | undefined, totalCents: number): BnplQuote {
    const quote = this.quote(partnerCode, totalCents);
    if (!quote.approved || !quote.reference || !quote.installmentCount || !quote.installmentCents) {
      throw new BadRequestException(quote.reason ?? 'BNPL was not approved');
    }
    return quote;
  }
}
