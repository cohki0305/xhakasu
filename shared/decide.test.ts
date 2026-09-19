import { expect, test } from "bun:test";
import { DEFAULT_GENRES } from "./defaults";
import { decide, type DecideSettings } from "./decide";
import type { Verdict } from "./types";

// 初期ジャンルで wanted なのは tech / fitness / other
const base: DecideSettings = { genres: DEFAULT_GENRES, hideOffensive: true, hideSexual: true, strictness: "normal" };
const v = (genre: Record<string, number>, offensive = 0.01, sexual = 0.01): Verdict => ({ genre, offensive, sexual });

test("見たいジャンルは通す", () => {
  expect(decide(v({ tech: 1 }), base)).toEqual({ action: "show" });
});

test("見たくないジャンルは genre で非表示", () => {
  expect(decide(v({ politics: 1 }), base)).toEqual({ action: "hide", reason: "genre" });
});

test("割れた投稿は、見たいジャンルの確率の合計で決める", () => {
  const split = v({ tech: 0.52, business: 0.48 });
  expect(decide(split, base)).toEqual({ action: "show" }); // 0.52 >= 0.5
  expect(decide(split, { ...base, strictness: "strict" })).toEqual({ action: "hide", reason: "genre" }); // 0.52 < 0.7
});

test("合計がちょうど閾値なら通す（未満のときだけ非表示）", () => {
  expect(decide(v({ tech: 0.5, politics: 0.5 }), base)).toEqual({ action: "show" });
});

test("攻撃的はちょうど閾値から非表示", () => {
  expect(decide(v({ tech: 1 }, 0.7), base)).toEqual({ action: "hide", reason: "offensive" });
  expect(decide(v({ tech: 1 }, 0.69), base)).toEqual({ action: "show" });
});

test("性的 → 攻撃的 → ジャンルの順に理由を付ける", () => {
  expect(decide(v({ politics: 1 }, 0.99, 0.99), base).action).toBe("hide");
  expect(decide(v({ politics: 1 }, 0.99, 0.99), base)).toEqual({ action: "hide", reason: "sexual" });
  expect(decide(v({ politics: 1 }, 0.99, 0.0), base)).toEqual({ action: "hide", reason: "offensive" });
});

test("オプションがオフなら攻撃的・性的では非表示にしない", () => {
  const off = { ...base, hideOffensive: false, hideSexual: false };
  expect(decide(v({ tech: 1 }, 0.99, 0.99), off)).toEqual({ action: "show" });
});

test("skipGenre のときはジャンルを見ない（返信欄用）", () => {
  expect(decide(v({ politics: 1 }), base, { skipGenre: true })).toEqual({ action: "show" });
  expect(decide(v({ politics: 1 }, 0.99), base, { skipGenre: true })).toEqual({ action: "hide", reason: "offensive" });
});

test("厳しさで閾値が変わる", () => {
  expect(decide(v({ tech: 1 }, 0.6), { ...base, strictness: "strict" })).toEqual({ action: "hide", reason: "offensive" });
  expect(decide(v({ tech: 1 }, 0.8), { ...base, strictness: "loose" })).toEqual({ action: "show" });
});
