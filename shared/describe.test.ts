import { expect, test } from "bun:test";
import { DEFAULT_GENRES } from "./defaults";
import { describeHide } from "./describe";
import type { Verdict } from "./types";

const v: Verdict = { genre: { politics: 0.91, business: 0.06, other: 0.03 }, offensive: 0.98, sexual: 0.93 };

test("ジャンル外は 1 位のジャンル名と確率を出す", () => {
  expect(describeHide(v, "genre", DEFAULT_GENRES)).toBe("ジャンル外（政治 0.91）");
});

test("攻撃的・性的は確率を出す", () => {
  expect(describeHide(v, "offensive", DEFAULT_GENRES)).toBe("攻撃的（0.98）");
  expect(describeHide(v, "sexual", DEFAULT_GENRES)).toBe("性的（0.93）");
});

test("一覧に無いジャンル ID はそのまま出し、確率が空でも落ちない", () => {
  expect(describeHide({ ...v, genre: { g_old: 1 } }, "genre", DEFAULT_GENRES)).toBe("ジャンル外（g_old 1.00）");
  expect(describeHide({ ...v, genre: {} }, "genre", DEFAULT_GENRES)).toBe("ジャンル外");
});
