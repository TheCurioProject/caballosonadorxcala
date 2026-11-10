import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Strict tsc still runs in production builds. These legacy patterns are warnings
      // while correctness, hooks ordering, and unused suppression checks remain enabled.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/app/api/**/*.ts', 'src/app/api/**/*.tsx'],
    // PDF routes await renderToBuffer/renderToStream inside try/catch; they are not UI render functions.
    rules: { 'react-hooks/error-boundaries': 'off' },
  },
  {
    files: ['prisma/*.js', '*.js', 'scripts/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "src/generated/**",
    "public/admin/sw.js",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
