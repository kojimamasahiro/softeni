import fs from 'fs';
import path from 'path';

import { PlayerInfo } from '@/types/index';

export function getAllPlayers(): PlayerInfo[] {
  const playersDir = path.join(process.cwd(), 'data', 'players');
  const playerIds = fs.readdirSync(playersDir).filter((file) => {
    const fullPath = path.join(playersDir, file);
    // ディレクトリかつ information.json を持つ実プレイヤーフォルダのみ
    // （index.json / homonyms.json のようなファイルを除外する。なお playerStats の
    //  生成物 _facts / _index は 2026-08-28 に .playerstats/ へ移動済み）
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'information.json'));
  });

  return playerIds.map((id) => {
    const filePath = path.join(playersDir, id, 'information.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      id,
      lastName: data.lastName,
      firstName: data.firstName,
      lastNameKana: data.lastNameKana,
      firstNameKana: data.firstNameKana,
      team: data.team,
      position: data.position,
      handedness: data.handedness,
      birthDate: data.birthDate,
      height: data.height,
      profileLinks: data.profileLinks || [],
    };
  });
}
