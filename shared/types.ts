export type Genre = { id: string; name: string; description: string; wanted: boolean };
export type Strictness = "loose" | "normal" | "strict";
/** 非表示にした投稿の見せ方。bar: 理由つきのバーを残し、クリックで開ける / remove: 跡を残さず消す */
export type HiddenStyle = "bar" | "remove";

export type Settings = {
  genres: Genre[];
  hideOffensive: boolean;
  hideSexual: boolean;
  strictness: Strictness;
  hiddenStyle: HiddenStyle;
  relayUrl: string;
  accessKey: string;
  paused: boolean;
};

export type ChoiceQuestion = { type: "choice"; instructions: string; criteria: Record<string, string> };
export type NoulQuestion = { type: "noul"; instructions: string };
export type Questions = { genre: ChoiceQuestion; offensive: NoulQuestion; sexual: NoulQuestion };

/** Jev の答えを拡張が使う最小形に詰め直したもの */
export type Verdict = { genre: Record<string, number>; offensive: number; sexual: number };

export type HideReason = "genre" | "offensive" | "sexual";
export type HiddenInfo = { reason: HideReason; label: string };
export type Decision = { action: "show" } | { action: "hide"; reason: HideReason };

export type PostInput = { id: string; text: string };
export type ClassifyRequest = { questions: Questions; posts: PostInput[] };
export type ClassifyResponse = { results: Record<string, Verdict>; errors: Record<string, string> };
