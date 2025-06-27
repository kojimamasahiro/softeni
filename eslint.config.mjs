import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { FlatCompat } from '@eslint/eslintrc';
import pluginImport from 'eslint-plugin-import';
import pluginPrettier from 'eslint-plugin-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Next.js + TypeScript 用の互換設定（旧形式の取り込み）
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // 新形式の設定（Flat Config）
  {
    plugins: {
      import: pluginImport,
      prettier: pluginPrettier,
    },
    rules: {
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
        },
      ],
      'prettier/prettier': 'warn',
    },
  },
];
