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

// 絵文字の検出パターン。
//
// 既定で絵文字として描画される文字（`Emoji_Presentation`）と、異体字セレクタ U+FE0F
// （`⚠️` のように「絵文字として描け」と明示しているもの）だけを対象にする。
//
// `Extended_Pictographic` を使わないのは範囲が広すぎるため: `©` `®` `↗` `▶` `◀` `‼` などが
// 含まれてしまう。これらは既定でテキスト表示され、フォント差も小さいので許可したい。
//
// 意図的に対象外:
// - 矢印（→ ← ↗）、幾何学図形（▲ ▼ ◀ ▶ ○ ●）、罫線（─）、チェック記号（✓ ✗ ✕）、
//   丸数字（① ②）、著作権記号（©）。いずれも通常の記号でありフォント差が小さい。
// - AGENTS.md「UI の表記ルール」の対象は公開ページの UI なので、このルールは `src/**` にだけ
//   適用する。SNS 投稿テンプレ（lib/rareEvents.mjs）と CLI 出力（scripts/**）は
//   人間が一度読むだけの出力なので対象外。
const EMOJI_PATTERN = String.raw`[\p{Emoji_Presentation}️]`;

const noEmojiRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: `JSXText[value=/${EMOJI_PATTERN}/u]`,
      message: '公開 UI に絵文字を使わないでください（AGENTS.md「UI の表記ルール」）。装飾は inline SVG か CSS で描いてください。',
    },
    {
      selector: `Literal[value=/${EMOJI_PATTERN}/u]`,
      message: '公開 UI に絵文字を使わないでください（AGENTS.md「UI の表記ルール」）。装飾は inline SVG か CSS で描いてください。',
    },
    {
      selector: `TemplateElement[value.raw=/${EMOJI_PATTERN}/u]`,
      message: '公開 UI に絵文字を使わないでください（AGENTS.md「UI の表記ルール」）。装飾は inline SVG か CSS で描いてください。',
    },
  ],
};

const config = [
  // Next.js + TypeScript 用の互換設定（旧形式の取り込み）
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // 絵文字禁止（公開 UI のみ）
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    rules: noEmojiRules,
  },

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
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
        },
      ],
      'prettier/prettier': 'warn',
    },
  },
];

export default config;
