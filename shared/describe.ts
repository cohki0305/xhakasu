import type { Genre, HideReason, Verdict } from "./types";

/** 非表示にした理由を、精度を確かめられるよう Jev の確率つきで文言にする */
export function describeHide(verdict: Verdict, reason: HideReason, genres: Genre[]): string {
  if (reason === "offensive") return `攻撃的（${verdict.offensive.toFixed(2)}）`;
  if (reason === "sexual") return `性的（${verdict.sexual.toFixed(2)}）`;
  const top = Object.entries(verdict.genre).sort((a, b) => b[1] - a[1])[0];
  if (!top) return "ジャンル外";
  const name = genres.find((g) => g.id === top[0])?.name ?? top[0];
  return `ジャンル外（${name} ${top[1].toFixed(2)}）`;
}
