import { GENRE_THRESHOLD, HARM_THRESHOLD } from "./defaults";
import type { Decision, Settings, Verdict } from "./types";

export type DecideSettings = Pick<Settings, "genres" | "hideOffensive" | "hideSexual" | "strictness">;

/**
 * Jev の確率と設定から「通す／非表示」を決める。
 * - 評価順は 性的 → 攻撃的 → ジャンル。最初に当たった理由を返す
 * - 攻撃的・性的は HARM_THRESHOLD[strictness] 以上で非表示（オプションがオンのときだけ）
 * - ジャンルは wanted なジャンルの確率の合計が GENRE_THRESHOLD[strictness] 未満なら非表示
 * - opts.skipGenre が true ならジャンルは評価しない
 */
export function decide(verdict: Verdict, settings: DecideSettings, opts: { skipGenre?: boolean } = {}): Decision {
  throw new Error("decide: 未実装");
}
