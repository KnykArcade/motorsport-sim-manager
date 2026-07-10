export type RaceSeries = 'nascar' | 'f1' | 'indycar' | 'cart';

export function normalizeSeries(series: string | undefined, fallback: RaceSeries = 'f1'): RaceSeries {
  switch (series?.toLowerCase()) {
    case 'f1':
    case 'formula 1':
      return 'f1';
    case 'indycar':
      return 'indycar';
    case 'cart':
    case 'champ car':
      return 'cart';
    case 'nascar':
      return 'nascar';
    default:
      return fallback;
  }
}
