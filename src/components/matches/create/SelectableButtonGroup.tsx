type SelectableOption = {
  value: string;
  label: string;
};

type SelectableButtonGroupProps = {
  name: string;
  ariaLabel: string;
  options: SelectableOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 1 | 2 | 3 | 4;
};

// grid-cols-N は Tailwind の静的解析のため固定マップで持つ（動的クラス名は生成しない）
const COLUMN_CLASSES: Record<NonNullable<SelectableButtonGroupProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

/**
 * ラジオボタン群を、他画面（スコア入力・動画レビュー）と統一感のあるボタン選択UIとして表示する。
 * 見た目はボタンだが実体は native radio input のため、キーボード操作・スクリーンリーダー対応は
 * ブラウザ標準のまま維持される。
 */
const SelectableButtonGroup = ({ name, ariaLabel, options, value, onChange, columns = 2 }: SelectableButtonGroupProps) => (
  <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 ${COLUMN_CLASSES[columns]}`}>
    {options.map((option) => {
      const inputId = `${name}-${option.value}`;

      return (
        <div key={option.value}>
          <input
            type="radio"
            id={inputId}
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            className="block cursor-pointer rounded border-2 border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2"
          >
            {option.label}
          </label>
        </div>
      );
    })}
  </div>
);

export default SelectableButtonGroup;
