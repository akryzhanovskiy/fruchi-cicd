import type { ProductCard } from '@fruchi/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

export const makeProduct = (overrides: Partial<ProductCard> = {}): ProductCard => ({
  slug: 'apple',
  name: 'Яблучні чіпси',
  short_desc: 'Солодко-кислі',
  category: 'chips',
  price: 89,
  weight_g: 100,
  accent_color: '#F7DCD3',
  illustration: 'apple',
  image: null,
  in_stock: true,
  max_qty: 3,
  ...overrides,
});

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
