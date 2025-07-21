/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

const WIDTH = 1200;
const HEIGHT = 630;
const IMAGE_URL_BASE = 'https://softeni-pick.com/og/tournament';

const LEFT = 70;
const RIGHT = 780;
const TEAM_OFFSET = 40;
const TEXT_WIDTH = 350;
const NAME_FONT_SIZE = 28;
const TEAM_FONT_SIZE = 18;
const PAIR_HEIGHT = 107;

const topScorePositions = [
  { top: 175, left: 495 },
  { top: 385, left: 495 },
  { top: 175, left: 690 },
  { top: 385, left: 690 },
  { top: 230, left: 555 },
  { top: 230, left: 635 },
  { top: 330, left: 555 },
];

const bottomScorePositions = [
  { top: 325, left: 495 },
  { top: 535, left: 495 },
  { top: 325, left: 690 },
  { top: 535, left: 690 },
  { top: 480, left: 555 },
  { top: 480, left: 635 },
  { top: 330, left: 635 },
];

const textStyle = {
  position: 'absolute',
  width: TEXT_WIDTH,
  display: 'flex',
  justifyContent: 'flex-end',
  color: '#000',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
} as const;

function SpacedText({
  text,
  top,
  left,
  width,
  fontSize,
}: {
  text: string;
  top: number;
  left: number;
  width: number;
  fontSize: number;
}) {
  const chars = text.split('');
  const letterSpacing =
    chars.length > 1
      ? (width - fontSize * chars.length) / (chars.length - 1)
      : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        height: fontSize + 10,
        fontSize,
        fontWeight: 'bold',
        color: '#000',
        display: 'flex',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {chars.map((char, i) => (
        <span
          key={i}
          style={{ marginRight: i !== chars.length - 1 ? letterSpacing : 0 }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

function renderPairBlock(
  pair: { name: string; team: string },
  i: number,
  left: number,
) {
  const nameTop = 175 + i * PAIR_HEIGHT;
  const teamTop = nameTop + TEAM_OFFSET;

  return (
    <>
      <SpacedText
        key={`name-${left}-${i}`}
        text={pair.name}
        top={nameTop}
        left={left}
        width={TEXT_WIDTH}
        fontSize={NAME_FONT_SIZE}
      />
      <div
        key={`team-${left}-${i}`}
        style={{
          ...textStyle,
          top: teamTop,
          left,
          fontSize: TEAM_FONT_SIZE,
        }}
      >
        {pair.team}
      </div>
    </>
  );
}

function renderScoreBlocks(
  positions: { top: number; left: number }[],
  values: string[],
) {
  return positions.map((pos, i) => (
    <div
      key={`score-${i}`}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        fontSize: 20,
        color: '#000',
      }}
    >
      {values[i]}
    </div>
  ));
}

function getOverlayPaths(topScores: string[], bottomScores: string[]) {
  const overlayBase = ['base.png'];
  const overlayLabels = ['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'final'];

  const comparisons = overlayLabels.map((label, i) => {
    const top = Number(topScores[i]);
    const bottom = Number(bottomScores[i]);
    if (top > bottom) return `${label}-t.png`;
    if (top < bottom) return `${label}-b.png`;
    return null; // 同点や未入力などの場合はスキップ（または fallback 可）
  });

  return overlayBase.concat(comparisons.filter((v): v is string => v !== null));
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  function parseJsonParam<T>(key: string, fallback: T): T {
    try {
      const raw = searchParams.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  const leftPairs = parseJsonParam<{ name: string; team: string }[]>(
    'leftPairs',
    [
      { name: '', team: '' },
      { name: '', team: '' },
      { name: '', team: '' },
      { name: '', team: '' },
    ],
  );

  const rightPairs = parseJsonParam<{ name: string; team: string }[]>(
    'rightPairs',
    [
      { name: '', team: '' },
      { name: '', team: '' },
      { name: '', team: '' },
      { name: '', team: '' },
    ],
  );

  const topScoreValues = parseJsonParam<string[]>('topScores', [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  const bottomScoreValues = parseJsonParam<string[]>('bottomScores', [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  const overlayPaths = getOverlayPaths(topScoreValues, bottomScoreValues);

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          display: 'flex',
        }}
      >
        {overlayPaths.map((filename, idx) => (
          <img
            key={idx}
            src={`${IMAGE_URL_BASE}/${filename}`}
            alt={`overlay-${idx}`}
            width={WIDTH}
            height={HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        ))}

        {leftPairs.map((pair, i) => renderPairBlock(pair, i, LEFT))}
        {rightPairs.map((pair, i) => renderPairBlock(pair, i, RIGHT))}

        {renderScoreBlocks(topScorePositions, topScoreValues)}
        {renderScoreBlocks(bottomScorePositions, bottomScoreValues)}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
