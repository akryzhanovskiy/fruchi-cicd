import { slugify } from './slug';

test.each([
  ['Яблучні чіпси', 'yabluchni-chipsy'],
  ['Грушеві чіпси', 'hrushevi-chipsy'],
  ['Пастила «Їжак»', 'pastyla-yizhak'],
  ['Мʼята та ялівець', 'miata-ta-yalivets'],
  ['  Mango 2024!  ', 'mango-2024'],
])('slugify(%j) = %j', (input, expected) => {
  expect(slugify(input)).toBe(expected);
});
