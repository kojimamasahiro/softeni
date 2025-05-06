import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;

module.exports = {
  plugins: ['import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',      // Node.js built-ins
          'external',     // npm modules
          'internal',     // alias (@/components など)
          ['parent', 'sibling', 'index'], // 相対パス
        ],
        'newlines-between': 'always', // 各グループの間に空行
      },
    ],
    'prettier/prettier': 'warn',
  },
};

