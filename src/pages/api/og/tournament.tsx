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

const overlayPaths = [
  'base.png',
  'qf1-t.png',
  'qf2-b.png',
  'qf3-b.png',
  'qf4-t.png',
  'sf1-t.png',
  'sf2-b.png',
  'final-t.png',
];

const leftPairs = [
  { name: '幡谷康平・端山羅行', team: 'ＮＴＴ東日本東京・稲門クラブ' },
  { name: '浅見竣一朗・安達宣', team: '早稲田大学' },
  { name: '齋藤翔一・桑山信', team: '日本信号' },
  { name: '大村圭志朗・佐藤大和', team: 'アキム' },
];

const rightPairs = [
  { name: '片岡暁紀・黒坂卓矢', team: '日本体育大学' },
  { name: '高橋拓己・広岡大河', team: '法政大学' },
  { name: '品川貴紀・早川和宏', team: '福井県庁' },
  { name: '田中康文・金子大祐', team: '厚木市役所' },
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
  scores: { top: number; left: number; value: string }[],
) {
  return scores.map((s, i) => (
    <div
      key={`score-${i}`}
      style={{
        position: 'absolute',
        top: s.top,
        left: s.left,
        fontSize: 20,
        color: '#000',
      }}
    >
      {s.value}
    </div>
  ));
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '幡谷康平・端山羅行';

  const leftScores = [
    { top: 175, left: 495, value: '4' },
    { top: 325, left: 495, value: '2' },
    { top: 380, left: 495, value: '2' },
    { top: 535, left: 495, value: '4' },
    { top: 230, left: 555, value: '4' },
    { top: 480, left: 555, value: '0' },
    { top: 330, left: 555, value: '4' },
  ];

  const rightScores = [
    { top: 175, left: 690, value: '2' },
    { top: 325, left: 690, value: '4' },
    { top: 380, left: 690, value: '2' },
    { top: 535, left: 690, value: '4' },
    { top: 230, left: 635, value: '3' },
    { top: 480, left: 635, value: '4' },
    { top: 330, left: 635, value: '1' },
  ];

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

        <SpacedText
          key="winner"
          text={name}
          top={80}
          left={425}
          width={TEXT_WIDTH}
          fontSize={NAME_FONT_SIZE}
        />

        {renderScoreBlocks(leftScores)}
        {renderScoreBlocks(rightScores)}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
