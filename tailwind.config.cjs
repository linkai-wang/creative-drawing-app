/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  // The reference gallery composes its column class from its image count.
  safelist: ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--accent)',
        secondary: 'var(--warm)',
        accent: 'var(--accent)',
        light: 'var(--paper)',
        dark: 'var(--ink)'
      }
    }
  }
};
