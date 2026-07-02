// src/components/PageLayout.tsx
import { ReactNode } from 'react';

const WIDTH_CLASSES = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
} as const;

type Props = {
  /** コンテンツの最大幅（デフォルト: 3xl） */
  maxWidth?: keyof typeof WIDTH_CLASSES;
  /** 内側コンテナに追加するクラス（space-y-* など） */
  className?: string;
  children: ReactNode;
};

/**
 * 全公開ページ共通のレイアウト。
 * 外側: 背景色・上下余白（py-10 px-4）を統一
 * 内側: max-w-* mx-auto のコンテンツコンテナ
 * 注意: <main> は _app.tsx 側でラップされるため、ここでは div を使う。
 */
export default function PageLayout({ maxWidth = '3xl', className, children }: Props) {
  return (
    <div className="min-h-screen bg-white px-4 py-10 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <div className={`mx-auto ${WIDTH_CLASSES[maxWidth]}${className ? ` ${className}` : ''}`}>{children}</div>
    </div>
  );
}
