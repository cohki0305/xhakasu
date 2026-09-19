import { expect, test } from "bun:test";
import { DEFAULT_GENRES } from "../../shared/defaults";
import { buildQuestions } from "../../shared/questions";
import { parseRequest } from "./validate";

const questions = buildQuestions(DEFAULT_GENRES);
const good = { questions, posts: [{ id: "123", text: "こんにちは" }] };

test("正しいリクエストを通す", () => {
  expect(parseRequest(good)).toEqual({ ok: true, value: good });
});

test.each([
  ["オブジェクトでない", null],
  ["posts が空", { questions, posts: [] }],
  ["posts が 21 件", { questions, posts: Array.from({ length: 21 }, (_, i) => ({ id: String(i + 1), text: "a" })) }],
  ["id が数字でない", { questions, posts: [{ id: "abc", text: "a" }] }],
  ["本文が空", { questions, posts: [{ id: "1", text: "" }] }],
  ["本文が 4001 字", { questions, posts: [{ id: "1", text: "あ".repeat(4001) }] }],
  ["genre に other がない", { questions: { ...questions, genre: { ...questions.genre, criteria: { tech: "開発" } } }, posts: good.posts }],
  ["ジャンルが 21 個", { questions: { ...questions, genre: { ...questions.genre, criteria: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`g${i}`, "x"]).concat([["other", "x"]])) } }, posts: good.posts }],
  ["説明文が 201 字", { questions: { ...questions, genre: { ...questions.genre, criteria: { other: "あ".repeat(201) } } }, posts: good.posts }],
  ["offensive が noul でない", { questions: { ...questions, offensive: { type: "choice", instructions: "x", criteria: {} } }, posts: good.posts }],
  ["余計な質問がある", { questions: { ...questions, extra: { type: "noul", instructions: "x" } }, posts: good.posts }],
])("弾く: %s", (_name, body) => {
  expect(parseRequest(body).ok).toBe(false);
});
