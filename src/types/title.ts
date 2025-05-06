export interface YearlyResult {
    year: number;
    result: string;
}

export interface MajorTitle {
    name: string;
    years: YearlyResult[];
}
