import { formatPhone, isCompletePhone } from './phone';

test.each([
  ['', '+380'],
  ['+380', '+380'],
  ['0671234567', '+380 67 123 45 67'],
  ['380671234567', '+380 67 123 45 67'],
  ['+38 (067) 123-45-67', '+380 67 123 45 67'],
  ['+380 67 123', '+380 67 123'],
  ['+380 67 123 45 67 89', '+380 67 123 45 67'],
])('formatPhone(%j) = %j', (raw, expected) => {
  expect(formatPhone(raw)).toBe(expected);
});

test('isCompletePhone', () => {
  expect(isCompletePhone('+380 67 123 45 67')).toBe(true);
  expect(isCompletePhone('+380 67 123')).toBe(false);
});
