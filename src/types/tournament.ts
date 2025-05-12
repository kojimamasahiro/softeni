import { MatchResult, Stage } from '@/types/common';

export interface Tournament {
    tournament: string;
    dateRange?: string;
    location?: string;
    link?: string;
    format: 'round-robin' | 'tournament' | 'combined';
    finalResult?: string;
    groupStage?: Stage;
    finalStage?: Stage;
    results?: MatchResult[];
    partner?: string;
}

export interface TournamentSummary {
    id: string;
    meta: {
        sortId: number;
        name: string;
        region: string;
        type: string;
        category: string;
        officialUrl: string;
        isMajorTitle: boolean;
    };
    years: TournamentYearData[];
}

export interface TournamentYearData {
    year: string;
    status: string;
    scheduledDate?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    url?: string;
    results?: { playerIds: string[]; result: string }[];
}

export interface TournamentMeta {
    id: string;
    sortId: number;
    name: string;
    region: string;
    type: string;
    category: string;
    officialUrl: string;
    isMajorTitle: boolean;
}
