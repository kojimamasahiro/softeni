export interface MatchResult {
    round: string;
    opponent: string;
    result: string;
    score: string;
    partner?: string;
}

export interface Stage {
    format: 'round-robin' | 'tournament';
    group?: string;
    results: MatchResult[];
}
