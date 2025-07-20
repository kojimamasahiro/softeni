import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '選手名';

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '600px',
          height: '315px',
          display: 'flex', // ✅ 追加
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://softeni-pick.com/og/base.jpg"
          alt="背景画像"
          width={600}
          height={315}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />

        {/* テキスト */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 100,
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 6px rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
      </div>
    ),
    {
      width: 600,
      height: 315,
    },
  );
}
