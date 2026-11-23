import { makeProduct } from '../test-utils';
import { cartTotal, isProblem, useCart } from './cart';

beforeEach(() => useCart.getState().clear());

test('adds products and caps quantity at max_qty', () => {
  const product = makeProduct({ max_qty: 3 });
  useCart.getState().add(product, 2);
  useCart.getState().add(product, 5);
  expect(useCart.getState().items).toMatchObject([{ slug: 'apple', qty: 3 }]);
});

test('ignores out-of-stock products', () => {
  useCart.getState().add(makeProduct({ in_stock: false, max_qty: 0 }));
  expect(useCart.getState().items).toEqual([]);
});

test('setQty to zero removes the item', () => {
  useCart.getState().add(makeProduct());
  useCart.getState().setQty('apple', 0);
  expect(useCart.getState().items).toEqual([]);
});

test('sync refreshes prices and marks products no longer sold as unavailable', () => {
  useCart.getState().add(makeProduct({ slug: 'apple', price: 89 }), 2);
  useCart.getState().add(makeProduct({ slug: 'pear', name: 'Груша' }));
  useCart.getState().sync([makeProduct({ slug: 'apple', price: 95, max_qty: 1 })]);

  const [apple, pear] = useCart.getState().items;
  expect(apple).toMatchObject({ price: 95, maxQty: 1, qty: 2 });
  expect(isProblem(apple)).toBe(true);
  expect(pear.maxQty).toBe(0);
  expect(cartTotal(useCart.getState().items)).toBe(0);
});

test('applyUnavailable lowers max quantity from a rejected order', () => {
  useCart.getState().add(makeProduct(), 3);
  useCart.getState().applyUnavailable([{ slug: 'apple', name: 'Яблучні', available: 1 }]);
  expect(useCart.getState().items[0]).toMatchObject({ qty: 3, maxQty: 1 });
});
