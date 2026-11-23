const priceFormat = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });

export const formatPrice = (value: number) => `${priceFormat.format(value)} ₴`;

export const formatWeight = (grams: number) =>
  grams >= 1000 ? `${priceFormat.format(grams / 1000)} кг` : `${grams} г`;
