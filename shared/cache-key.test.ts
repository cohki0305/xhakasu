import { expect, test } from "bun:test";
import { canonical, cacheKey } from "./cache-key";
import { DEFAULT_GENRES } from "./defaults";
import { buildQuestions } from "./questions";

const q = buildQuestions(DEFAULT_GENRES);

test("canonical はキーの順序に依らない", () => {
  expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
});

test("同じ本文と質問なら同じ鍵、64 桁の 16 進", async () => {
  const k = await cacheKey("こんにちは", q);
  expect(k).toMatch(/^[0-9a-f]{64}$/);
  expect(await cacheKey("こんにちは", q)).toBe(k);
});

test("前後の空白と連続空白の違いは同じ鍵になる", async () => {
  expect(await cacheKey("  今日は  いい天気\n\n", q)).toBe(await cacheKey("今日は いい天気", q));
});

test("本文が違えば別の鍵", async () => {
  expect(await cacheKey("A", q)).not.toBe(await cacheKey("B", q));
});

test("ジャンルの説明文を変えると別の鍵", async () => {
  const edited = DEFAULT_GENRES.map((g) => (g.id === "tech" ? { ...g, description: "Rust だけ" } : g));
  expect(await cacheKey("A", buildQuestions(edited))).not.toBe(await cacheKey("A", q));
});
