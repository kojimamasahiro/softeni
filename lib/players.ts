import { PlayerInfo } from '@/types/index';
import fs from 'fs';
import path from 'path';

export function getAllPlayers(): PlayerInfo[] {
  const playersDir = path.join(process.cwd(), 'data', 'players');
  const playerIds = fs.readdirSync(playersDir);

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
