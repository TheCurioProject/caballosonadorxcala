import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-beige': '#F9F7F4',
        'brand-cream': '#F9F7F4',
        'brand-white': '#FFFFFF',
        'brand-dark': '#23211F',
        'brand-brown': '#9B7E67',
        'brand-terracotta': '#9B7E67',
        'brand-black': '#2C2927',
        'brand-gray': '#524D48',
      },
      fontFamily: {
        sans: ['var(--font-syne)', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
