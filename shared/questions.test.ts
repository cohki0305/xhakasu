import { expect, test } from "bun:test";
import { DEFAULT_GENRES } from "./defaults";
import { buildQuestions } from "./questions";

test("3 問を必ず作り、全ジャンルを criteria に並べる", () => {
  const q = buildQuestions(DEFAULT_GENRES);
  expect(Object.keys(q)).toEqual(["genre", "offensive", "sexual"]);
  expect(q.genre.type).toBe("choice");
  expect(Object.keys(q.genre.criteria)).toEqual(DEFAULT_GENRES.map((g) => g.id));
  expect(q.genre.criteria.politics).toBe("政治、選挙、政党、社会運動");
  expect(q.offensive.type).toBe("noul");
  expect(q.sexual.type).toBe("noul");
});

test("wanted がオフのジャンルも criteria に残す", () => {
  const q = buildQuestions(DEFAULT_GENRES);
  expect(q.genre.criteria).toHaveProperty("politics");
});

test("other が欠けていたら末尾に足す", () => {
  const q = buildQuestions([{ id: "tech", name: "テック", description: "開発", wanted: true }]);
  expect(Object.keys(q.genre.criteria)).toEqual(["tech", "other"]);
});

test("wanted の切り替えでは質問が変わらない（台帳の鍵を割らないため）", () => {
  const flipped = DEFAULT_GENRES.map((g) => ({ ...g, wanted: !g.wanted }));
  expect(buildQuestions(flipped)).toEqual(buildQuestions(DEFAULT_GENRES));
});
