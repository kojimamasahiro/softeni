import fs from 'fs';
import path from 'path';

import { ImageResponse } from '@vercel/og';
import type { NextApiRequest, NextApiResponse } from 'next';

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
        style={{ ...textStyle, top: teamTop, left, fontSize: TEAM_FONT_SIZE }}
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
    const topScore = topScores[i];
    if (topScore === 'R') return `${label}-b.png`;
    if (topScore === '') return `${label}-t.png`;
    const bottomScore = bottomScores[i];
    if (bottomScore === 'R') return `${label}-t.png`;
    if (bottomScore === '') return `${label}-b.png`;
    const top = Number(topScore);
    const bottom = Number(bottomScore);
    if (top > bottom) return `${label}-t.png`;
    if (top < bottom) return `${label}-b.png`;
    return null;
  });

  return overlayBase.concat(comparisons.filter((v): v is string => v !== null));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { generation, tournamentId, year, gameCategory, ageCategory, gender } =
    req.query as {
      generation?: string;
      tournamentId?: string;
      year?: string;
      gameCategory?: string;
      ageCategory?: string;
      gender?: string;
    };

  if (!generation || !tournamentId || !year || !gameCategory || !gender) {
    return redirectToFallbackImage(res);
  }

  // categoryId例: 'doubles-boys', 'doubles-u12-girls', 'versus-boys'
  const categoryId = [gameCategory, ageCategory, gender]
    .filter(Boolean)
    .join('-');

  // ここをユーザー要望どおりに修正： og/{categoryId}.json
  const jsonPath = path.resolve(
    process.cwd(),
    'data/tournaments',
    generation,
    tournamentId,
    year,
    'og',
    `${categoryId}.json`,
  );

  if (!fs.existsSync(jsonPath)) {
    return redirectToFallbackImage(res);
  }

  type TournamentData = {
    leftPairs: { name: string; team: string }[];
    rightPairs: { name: string; team: string }[];
    topScores: string[];
    bottomScores: string[];
  };

  let data: TournamentData;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return redirectToFallbackImage(res);
  }

  const {
    leftPairs = [],
    rightPairs = [],
    topScores = [],
    bottomScores = [],
  } = data;
  const overlayPaths = getOverlayPaths(topScores, bottomScores);

  const image = new ImageResponse(
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={idx}
            src={`${IMAGE_URL_BASE}/${filename}`}
            alt={`overlay-${idx}`}
            width={WIDTH}
            height={HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        ))}
        {leftPairs.map((pair: { name: string; team: string }, i: number) =>
          renderPairBlock(pair, i, LEFT),
        )}
        {rightPairs.map((pair: { name: string; team: string }, i: number) =>
          renderPairBlock(pair, i, RIGHT),
        )}
        {renderScoreBlocks(topScorePositions, topScores)}
        {renderScoreBlocks(bottomScorePositions, bottomScores)}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );

  res.setHeader('Content-Type', 'image/png');
  res.status(200).end(Buffer.from(await image.arrayBuffer()));
}

async function redirectToFallbackImage(res: NextApiResponse) {
  const fallbackImageUrl = 'https://softeni-pick.com/og-image.jpg';
  try {
    const response = await fetch(fallbackImageUrl);
    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.status(200).end(Buffer.from(buffer));
  } catch {
    res.status(500).send('Fallback image fetch failed');
  }
}
