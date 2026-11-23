import { act, fireEvent, screen } from '@testing-library/react';

import { useCart } from '../store/cart';
import { renderWithProviders } from '../test-utils';
import { CartDrawer } from './CartDrawer';

beforeEach(() => {
  useCart.getState().clear();
  useCart.getState().close();
});

test('stays mounted while closing and unmounts when the slide-out animation ends', () => {
  renderWithProviders(<CartDrawer />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  act(() => useCart.getState().open());
  const dialog = screen.getByRole('dialog');
  expect(screen.getByText('Кошик порожній')).toBeInTheDocument();

  act(() => useCart.getState().close());
  expect(screen.getByRole('dialog')).toBeInTheDocument();

  fireEvent.animationEnd(dialog);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('unmounts after a timeout if animationend never fires (background tab)', () => {
  vi.useFakeTimers();
  renderWithProviders(<CartDrawer />);
  act(() => useCart.getState().open());
  act(() => useCart.getState().close());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  vi.useRealTimers();
});
