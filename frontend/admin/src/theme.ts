import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Shades around the brand "apple red" #B3322A (index 6).
const apple: MantineColorsTuple = [
  '#fdeceb',
  '#f6d6d3',
  '#eeaaa4',
  '#e57b72',
  '#dc5449',
  '#c63f34',
  '#b3322a',
  '#9a2a23',
  '#80221c',
  '#661a15',
];

export const theme = createTheme({
  primaryColor: 'apple',
  colors: { apple },
  fontFamily: 'Nunito, system-ui, sans-serif',
  headings: { fontFamily: "'Montserrat Alternates', 'Century Gothic', sans-serif" },
  defaultRadius: 'md',
});
