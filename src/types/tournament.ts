// src/types/tournament.ts

export interface TournamentIndexEntry {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
  federationId?: string;
  /** 高校総体の地区（ブロック）大会など、複数都道府県にまたがる大会の所属ブロックID。federationId とは排他 */
  blockId?: string;
  /**
   * 結果が `data/tournaments/details/` ではなく専用の特集ページ側にある大会の、その特集トップ（例: STリーグ→`/st-league/`）。
   * 設定するとハブページ（`/tournaments/[generation]/[tournamentId]`）は特集への誘導バナーを出し、
   * 特集ページとのカニバリを避けるため `noindex, follow` になる（高校全国大会と同じ扱い。docs/wiki/seo.md #3）。
   */
  featurePath?: string;
  /**
   * 検索で実際に使われる大会名。`label`（正式名称）と食い違う大会だけ設定する。
   * 設定するとハブ・年度別結果ページの title / h1 / description がこちらを主表記にし、
   * 正式名称は併記へ回る（置き換えではない）。未設定なら `label` をそのまま使い表示は変わらない。
   *
   * 例: 全中の正式名称「全国中学校体育大会」は全競技共通の名称で、
   * ソフトテニスの利用者は「全国中学校ソフトテニス大会」で検索する。
   * docs/wiki/seo.md「大会名の表記と検索語の乖離（missing literal）」
   */
  searchLabel?: string;
  /**
   * 略称・通称。先頭の 1 件が title / h1 に `略称（検索名）` の形で併記される。
   * `searchLabel` / `label` と重複する値は無視される（二重表記の防止）。
   */
  searchAliases?: string[];
  /**
   * 名称についての補足を1文で。`searchLabel` を主表記にすると正式名称が本文から消えるため、
   * その関係を明示する受け皿。h1 直下と FAQ に出る。
   *
   * 例: 全中は「全国中学校体育大会のソフトテニス競技」であって、`label` の
   * 「全国中学校大会」はサイト上の表記。この関係を書けるのはここだけ。
   */
  searchNote?: string;
}

export interface TournamentCategoryInfo {
  categoryId: string;
  label: string;
  category: string;
  gender: string;
  age: string;
  /**
   * 大会運営上の状態。'abandoned' は「途中で打ち切られ、以降の試合が実施されなかった」。
   * 未設定＝通常どおり最後まで実施（既存データは全て未設定）。
   * 打ち切り「理由」は保持しない（docs/raw/2026-07-26-abandoned-tournament-ui-design.md）。
   */
  status?: 'abandoned';
  /** status==='abandoned' のとき、最後に完了したラウンド名（例: "3回戦"）。 */
  abandonedAfterRound?: string;
  /**
   * 種目別の競技日程（開催前・開催中の大会で、主催者が種目ごとの日程を出している場合だけ）。
   * 出典は同じ年度の `TournamentInformationEntry.scheduleSource` / `scheduleSourceUrl`。
   * **予定**であって実績ではない。推測で埋めない（出典に無い日は書かない）。
   * docs/wiki/data-model.md「種目別の競技日程（`schedule`）」
   */
  schedule?: TournamentCategorySchedule;
  /**
   * その種目の競技方式（予選リーグの組数・通過数・決勝トーナメントの形など）。
   * **主催者が方式を公開していない大会で、見る人が画面から形式を読み取れないとき**だけ書く。
   * docs/wiki/data-model.md「種目別の競技方式（`format`）」/ docs/adr/ADR-021
   */
  format?: TournamentCategoryFormat;
}

export interface TournamentCategoryFormat {
  /**
   * 方式の説明。**1つの文章**で持つ（組数・通過数をフィールドに分けない。大会ごとに方式が
   * ばらばらで再利用が効かず、欄を推測で埋める圧力がかかるため。ADR-021）。
   */
  summary: string;
  /**
   * 出典から決まらず当サイトが推定した点。**画面には「当サイトの推定」と明記して出す**。
   * 推定が無ければ省略する（空配列を置かない）。
   */
  assumptions?: string[];
  /** 出典名。`summary` を書いたら必須 */
  source: string;
  /** 出典 URL。`summary` を書いたら必須 */
  sourceUrl: string;
  /** 出典を確認した日（YYYY-MM-DD）。主催者は会期中に方式表示を変えることがある */
  checkedOn?: string;
}

export interface TournamentCategorySchedule {
  /** その種目の最初の試合日（YYYY-MM-DD） */
  startDate: string;
  /** その種目の決勝日（YYYY-MM-DD）。1日で終わるなら startDate と同じ */
  endDate: string;
  /** 決勝の開始予定時刻（HH:MM、**会場の現地時刻**）。出典に無ければ省略 */
  finalTime?: string;
}

export interface TournamentInformationEntry {
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl: string;
  categories: TournamentCategoryInfo[];
  /** その年度の表示名（例: "第3回STリーグ"）。無ければ index.json の label を使う。 */
  label?: string;
  /**
   * 結果がこのサイト内の別ページにある場合の内部URL（例: STリーグ→`/st-league/2025/matches/`）。
   * `data/tournaments/details/` を持たない大会でも大会一覧から結果へ導線を張るために使う。
   */
  resultPath?: string;
  /**
   * 会場の構造化データ。大会と会場は 1:N（日別・種目別・複数市区町村）のため配列。
   * フィールド定義と記載ルールは docs/wiki/data-model.md「大会の会場データ（`venues`）」が正。
   */
  venues?: TournamentVenue[];
  /**
   * 入力時のメモ（出典の誤りや、値を書かなかった理由）。**公開ページには出さない**。
   * 「出さない」は描画結果だけでなく**ページのペイロード**も指す（`__NEXT_DATA__` に載るため）。
   * props に入れるときは `lib/tournamentInformationPublic.ts` の `toPublicInformationEntry()` を通す。
   * docs/wiki/data-model.md「入力メモ（`note`）は公開しない」
   */
  note?: string;
  /** 大会要項PDFのURL。取得できていなければ null。 */
  guidelineUrl?: string | null;
  /**
   * 大会運営上の状態。'cancelled' は「開催されなかった（中止）」。
   * 未設定＝開催された（既存データは全て未設定）。
   *
   * 回次（第N回）が進んだまま中止になった年（2020・2021 のコロナ禍など）を年表から
   * 落とすと「まだ収録していない年」と区別が付かないため、結果を持たない年エントリとして残す。
   * `location` / `startDate` / `endDate` は**中止時点の開催予定**であって実績ではない。
   * `categories` は空配列にする（1種目も実施されていないため）。
   *
   * カテゴリ単位の `TournamentCategoryInfo.status: 'abandoned'`（途中打ち切り）とは別物。
   * 打ち切りは途中まで実施されて成績が残るが、中止は1試合も行われていない。
   * docs/raw/2026-09-05-cancelled-tournament-editions.md
   */
  status?: 'cancelled';
  /** `categories[].schedule` の出典名（例: 大会公式リザルトサイト）。schedule を書いたら必須 */
  scheduleSource?: string;
  scheduleSourceUrl?: string;
  /** 出典を確認した日（YYYY-MM-DD）。主催者の日程は変わり得るので「いつ時点か」を併記する */
  scheduleCheckedOn?: string;
}

/**
 * 大会の会場1件。`data/tournaments/information/*.json` の `venues[]` に対応する。
 * 必須は prefecture / city / name の3つで、残りは出典（要項PDF等）に記載があるときだけ入る。
 * **推測で埋めない**（記載が無い・値が壊れている場合は省略し `note` に理由を残す）。
 */
export interface TournamentVenue {
  prefecture: string;
  city: string | null;
  name: string | null;
  aliases?: string[];
  /** 出典の表記そのまま。`name` を修正したときだけ書く */
  nameRaw?: string;
  postalCode?: string;
  /** 都道府県から書く。先頭が `prefecture` と一致するかで出典の誤記を検出できる */
  address?: string;
  tel?: string;
  courts?: number;
  /** 正規化語彙: クレー / ハード / 砂入り人工芝 / 木床フローリング */
  surface?: string;
  /** どの日・どの種目に使われたか。自由文 */
  usage?: string;
  /** 入力時のメモ。`TournamentInformationEntry.note` と同じく**公開しない**（ペイロードにも載せない） */
  note?: string;
}

export interface TournamentParticipant {
  id: string; // 金子_凌_松本市役所_長野
  lastName: string;
  firstName: string;
  team: string;
  prefecture: string | null;
  playerId?: number;
}

export interface TournamentEntry {
  entryNo: number;
  playerIds: string[];
  type?: string;
}

export interface TournamentMatch {
  entries: number[];
  scores: Record<string, number>;
  round: string | null;
  winnerEntryNo: number;
  retired: boolean;
  stage: string;
  group: string | null;
  matchId: string;
  nextMatchId: string | null;
  prevMatchIds: string[];
  prevMatchId: string | null;
  /** 団体戦の対戦ごとの記録（オーダー）。元資料にある大会・試合だけが持つ。詳細は docs/adr/ADR-020-team-match-rubber-details.md */
  matches?: TeamMatchDetail[];
}

/**
 * 団体戦の1対戦。形は STリーグの `MatchDetail`（src/utils/st-league.ts）に揃え、
 * 打ち切り・未実施と、個人戦の記録が無い選手を表せるように広げている。
 * A は親の `entries[0]`、B は `entries[1]`。
 */
export interface TeamMatchDetail {
  type: 'D1' | 'D2' | 'D3' | 'S';
  /**
   * completed: 決着 / retired: 途中棄権（棄権しなかった側の勝ち。**勝者の本数が多いとは限らない**）/
   * walkover: 不戦勝（片側がペアを出さなかった。試合は行われていないので本数は無い）/
   * unfinished: 団体の勝敗が決まって途中で打ち切り（勝者なし）/ not_played: 未実施
   */
  status: 'completed' | 'retired' | 'walkover' | 'unfinished' | 'not_played';
  /** completed / retired / walkover のときだけ 'A' か 'B'。それ以外は null */
  winner: 'A' | 'B' | null;
  /** not_played と walkover のときは null。retired は棄権した時点の本数 */
  scoreA: number | null;
  scoreB: number | null;
  /**
   * **walkover では、ペアを出さなかった側だけが空配列**になる。それ以外の状態では両側とも人数ぶん入る
   * （ダブルス2人・シングルス1人）。
   */
  playersA: TeamMatchPlayer[];
  playersB: TeamMatchPlayer[];
  /**
   * ゲームごとのポイント（`[A のポイント, B のポイント]` を実施順に）。
   * 元資料にゲームごとの記録がある大会だけが持つ（インターハイ。高校選抜は本数までしか印字されない）。
   * そのゲームを取ったのは**多いほう**（同点は無い）。デュースが続くと 10 以上になる。
   * **決着したゲームだけを持つ**。retired で中断されたゲーム（0-0 等）は入れない（取った側が決まらないため）。
   */
  games?: [number, number][];
}

/**
 * 個人戦の出場記録がある選手は姓・名（選手ページと同じ識別）、無い選手は名前だけ。
 * 名前だけの選手は participants に足さない（選手一覧で採番されないようにするため）。
 * `playerId` はデータには持たず、ページ生成時に姓・名から解決して付ける（participants と同じ）。
 */
export type TeamMatchPlayer = { lastName: string; firstName: string; playerId?: number } | { name: string; playerId?: number };

export interface TournamentResult {
  entryNo: number;
  tournament?: {
    label: string;
    rank: {
      kind: string;
      value: number;
    };
  };
  roundrobin?: {
    group: string;
    rank: number;
  };
}

/**
 * 決勝トーナメントのドロー（席順）。予選リーグ→決勝T形式の大会だけが持つ。
 *
 * 席は**エントリーではなく予選リーグの組に属する**ので (組, 組内順位) で書く。
 * `slots` の並びがそのままブラケットの席順で、長さは2の冪、`null` は空席（不戦勝）。
 * 詳細は docs/adr/ADR-015-knockout-draw-by-group.md。
 */
export interface KnockoutDraw {
  slots: ({ group: string; rank: number } | null)[];
}

export interface TournamentDetailData {
  participants: TournamentParticipant[];
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  results: TournamentResult[];
  knockoutDraw?: KnockoutDraw | null;
}

export type MatchRow = {
  matchId?: string;
  stage: string | null;
  group?: string | null;
  round?: string | null;
  opponentDisplayName?: string;
  /** 対戦相手のプレーヤーID（結果ページリンク用）。シングルスは1要素、ダブルスは最大2要素。 */
  opponentPlayerIds?: number[];
  /**
   * 直近の他大会で同じ相手と対戦していた場合の説明（前哨戦・再戦）。
   * lib/priorMeetings.ts / docs/wiki/news-context-blocks.md ⑥
   */
  rematchOf?: string | null;
  result: 'win' | 'lose' | 'draw';
  games: { won: string; lost: string };
  /** 組み合わせだけで未実施（勝者もスコアも無い）。スコア欄を「0-0」ではなく「未実施」にする */
  unplayed?: boolean;
  /** 団体戦の対戦ごとの記録（ADR-020）を、この行の組から見た向きに並べたもの。記録が無ければ undefined */
  teamMatches?: TeamMatchRow[];
};

/** 団体戦の1対戦を、ある組から見た向きにしたもの（MatchResults の表示用） */
export type TeamMatchRow = {
  type: TeamMatchDetail['type'];
  status: TeamMatchDetail['status'];
  /** 勝者が決まっている（completed / retired）ときだけ win / lose */
  result: 'win' | 'lose' | null;
  gamesWon: number | null;
  gamesLost: number | null;
  /**
   * ゲームごとのポイントを、この行の組から見た向き（`[この組, 相手]`）で実施順に並べたもの。
   * 元資料にゲームごとの記録がある大会だけが持つ（`TeamMatchDetail.games`）。
   */
  games?: [number, number][];
  own: { name: string; playerId?: number }[];
  opponent: { name: string; playerId?: number }[];
};
