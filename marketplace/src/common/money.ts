export function rands(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}
