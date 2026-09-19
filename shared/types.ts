export type Genre = { id: string; name: string; description: string; wanted: boolean };
export type Strictness = "loose" | "normal" | "strict";

export type Settings = {
  genres: Genre[];
  hideOffensive: boolean;
  hideSexual: boolean;
  strictness: Strictness;
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
export type Decision = { action: "show" } | { action: "hide"; reason: HideReason };

export type PostInput = { id: string; text: string };
export type ClassifyRequest = { questions: Questions; posts: PostInput[] };
export type ClassifyResponse = { results: Record<string, Verdict>; errors: Record<string, string> };
