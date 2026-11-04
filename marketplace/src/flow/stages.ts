export interface FlowStage {
  phase: 'setup' | 'discovery' | 'conversation' | 'transaction' | 'delivery' | 'post_sale';
  stage: string;
  summary: string;
}

export const MARKET_FLOW: readonly FlowStage[] = [
  {
    phase: 'setup',
    stage: 'languages',
    summary: 'Twelve official South African languages, plus any other language tag a stall wants to store.',
  },
  {
    phase: 'setup',
    stage: 'stall_setup',
    summary: 'Seller opens a stall with a map pin, copy, and the languages they can sell in.',
  },
  {
    phase: 'setup',
    stage: 'subscription',
    summary: 'Free basic stall, or a paid boosted stall with extra photos and higher map rank.',
  },
  {
    phase: 'setup',
    stage: 'menu',
    summary: 'Street-food menu with a prep-time estimate per dish.',
  },
  {
    phase: 'setup',
    stage: 'tour',
    summary: 'Virtual stall tour as an ordered set of scenes.',
  },
  {
    phase: 'setup',
    stage: 'supplier',
    summary: 'Supplier link so a low shelf can draft a reorder.',
  },
  {
    phase: 'setup',
    stage: 'barcode',
    summary: 'Barcode scan adds or removes stock.',
  },
  {
    phase: 'discovery',
    stage: 'map',
    summary: 'Live map ranks nearby stalls. Boosted stalls lift. Stock on the card ticks with sales.',
  },
  {
    phase: 'discovery',
    stage: 'wishlist',
    summary: 'Buyer saves a SKU to a wishlist.',
  },
  {
    phase: 'discovery',
    stage: 'flash',
    summary: 'Flash sale undercuts the shelf price until the countdown ends.',
  },
  {
    phase: 'conversation',
    stage: 'chat',
    summary: 'Buyer and seller share a thread with sent, delivered, and read ticks.',
  },
  {
    phase: 'conversation',
    stage: 'voice',
    summary: 'Seller replies with a voice note.',
  },
  {
    phase: 'transaction',
    stage: 'checkout',
    summary: 'Pay-now order at the flash price, including a made-to-order menu item.',
  },
  {
    phase: 'transaction',
    stage: 'inventory_tick',
    summary: 'That purchase decrements on-hand stock and publishes a map tick.',
  },
  {
    phase: 'transaction',
    stage: 'layaway',
    summary: 'Layaway reserves stock and collects installments.',
  },
  {
    phase: 'transaction',
    stage: 'bnpl',
    summary: 'Sandbox quote from a local BNPL partner, then a partner-funded order.',
  },
  {
    phase: 'transaction',
    stage: 'group_buy',
    summary: 'Buyers pool a target quantity, then the group settles together.',
  },
  {
    phase: 'transaction',
    stage: 'auction',
    summary: 'Rare unit is held, bid on, and sold to the high bidder when the clock ends.',
  },
  {
    phase: 'delivery',
    stage: 'delivery',
    summary: 'Nearest available runner picks up after prep and drops the order.',
  },
  {
    phase: 'post_sale',
    stage: 'referral',
    summary: 'The referring stall keeps the signup reward booked when the new stall joined.',
  },
  {
    phase: 'post_sale',
    stage: 'reorder',
    summary: 'Stock at or under the reorder point drafts a supplier purchase.',
  },
];
