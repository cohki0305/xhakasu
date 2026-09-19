import type { Genre, Settings, Strictness } from "./types";

export const OTHER_ID = "other";

export const DEFAULT_GENRES: Genre[] = [
  { id: "tech", name: "テック / AI", description: "ソフトウェア開発、AI、ガジェット", wanted: true },
  { id: "business", name: "ビジネス", description: "起業、経営、マーケティング、投資、キャリア", wanted: false },
  { id: "fitness", name: "フィットネス", description: "トレーニング、HYROX、ランニング、栄養", wanted: true },
  { id: "politics", name: "政治", description: "政治、選挙、政党、社会運動", wanted: false },
  { id: "entertainment", name: "エンタメ", description: "ドラマ、映画、音楽、芸能、アニメ、ゲーム", wanted: false },
  { id: "sports", name: "スポーツ", description: "プロスポーツの試合や選手の話題", wanted: false },
  { id: OTHER_ID, name: "その他", description: "上のどれにも当てはまらない", wanted: true },
];

export const DEFAULT_SETTINGS: Settings = {
  genres: DEFAULT_GENRES,
  hideOffensive: true,
  hideSexual: true,
  strictness: "normal",
  hiddenStyle: "bar",
  relayUrl: "",
  accessKey: "",
  paused: false,
};

/** 攻撃的・性的: この確率以上なら非表示 */
export const HARM_THRESHOLD: Record<Strictness, number> = { loose: 0.85, normal: 0.7, strict: 0.5 };
/** ジャンル: 見たいジャンルの確率の合計がこの値未満なら非表示 */
export const GENRE_THRESHOLD: Record<Strictness, number> = { loose: 0.3, normal: 0.5, strict: 0.7 };
