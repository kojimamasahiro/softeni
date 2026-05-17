import type { Match } from '@/types/database';

const betaMatchesStaticRoot = '/data/beta-matches';

type MatchListResponse = {
  matches?: Match[];
};

type MatchDetailResponse = {
  match?: Match | null;
};

const isJsonResponse = (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json');
};

const readJsonResponse = async <T>(response: Response) => {
  if (!response.ok || !isJsonResponse(response)) {
    return null;
  }

  return (await response.json()) as T;
};

export const hasLiveMatchApi = () => {
  return process.env.NODE_ENV === 'development';
};

export const fetchBetaMatches = async () => {
  if (hasLiveMatchApi()) {
    const apiResponse = await fetch('/api/matches');
    const apiData = await readJsonResponse<MatchListResponse>(apiResponse);

    if (apiData?.matches) {
      return apiData.matches;
    }
  }

  const staticResponse = await fetch(`${betaMatchesStaticRoot}/index.json`);
  const staticData = await readJsonResponse<MatchListResponse>(staticResponse);

  if (staticData?.matches) {
    return staticData.matches;
  }

  throw new Error('Failed to load beta matches');
};

export const fetchBetaMatchById = async (matchId: string) => {
  if (hasLiveMatchApi()) {
    const apiResponse = await fetch(`/api/matches/${matchId}`);
    const apiData = await readJsonResponse<MatchDetailResponse>(apiResponse);

    if (apiData?.match) {
      return apiData.match;
    }
  }

  const staticResponse = await fetch(
    `${betaMatchesStaticRoot}/matches/${matchId}.json`,
  );
  const staticData =
    await readJsonResponse<MatchDetailResponse>(staticResponse);

  return staticData?.match ?? null;
};
