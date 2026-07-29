export function formatMoney(cents: number | null): string {
  if (cents === null) return 'Contact for pricing';
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function primaryUnit<T extends { rentCents: number | null }>(units: T[]): T | null {
  if (units.length === 0) return null;
  return units[0];
}
