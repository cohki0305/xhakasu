import { beforeEach, expect, test } from "bun:test";
import { DEFAULT_GENRES } from "../../shared/defaults";
import type { DecideSettings } from "../../shared/decide";
import type { ClassifyResponse, PostInput, Verdict } from "../../shared/types";
import { Tracker, type PostState } from "./tracker";

const settings: DecideSettings = { genres: DEFAULT_GENRES, hideOffensive: true, hideSexual: true, strictness: "normal" };
const ok: Verdict = { genre: { tech: 1 }, offensive: 0, sexual: 0 };
const politics: Verdict = { genre: { politics: 1 }, offensive: 0, sexual: 0 };
const list = { exempt: false, skipGenre: false };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let calls: PostInput[][];
let applied: [string, PostState][];
let hidden: string[];
let respond: (posts: PostInput[]) => Promise<ClassifyResponse>;

const make = (opts = {}) =>
  new Tracker(
    {
      classify: (posts) => (calls.push(posts), respond(posts)),
      apply: (id, state) => applied.push([id, state]),
      onHidden: (reason) => hidden.push(reason),
    },
    settings,
    { batchMs: 5, timeoutMs: 40, ...opts },
  );

beforeEach(() => {
  calls = [];
  applied = [];
  hidden = [];
  respond = async (posts) => ({ results: Object.fromEntries(posts.map((p) => [p.id, ok])), errors: {} });
});

test("pending にしてから、結果で shown にする", async () => {
  make().see({ id: "1", text: "a" }, list);
  expect(applied).toEqual([["1", "pending"]]);
  await sleep(20);
  expect(applied).toEqual([["1", "pending"], ["1", "shown"]]);
});

test("束ねて 1 回で送る", async () => {
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  t.see({ id: "2", text: "b" }, list);
  await sleep(20);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.map((p) => p.id)).toEqual(["1", "2"]);
});

test("maxBatch を超えたら分けて送る", async () => {
  const t = make({ maxBatch: 2 });
  for (const id of ["1", "2", "3"]) t.see({ id, text: id }, list);
  await sleep(20);
  expect(calls.map((c) => c.length)).toEqual([2, 1]);
});

test("見たくないジャンルは hidden、onHidden は ID ごとに 1 回", async () => {
  respond = async () => ({ results: { "1": politics }, errors: {} });
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  await sleep(20);
  t.see({ id: "1", text: "a" }, list); // スクロールで戻ってきた
  expect(applied.at(-1)).toEqual(["1", "hidden"]);
  expect(hidden).toEqual(["genre"]);
  expect(calls).toHaveLength(1); // 再問い合わせしない
});

test("skipGenre ならジャンル外でも shown", async () => {
  respond = async () => ({ results: { "1": politics }, errors: {} });
  make().see({ id: "1", text: "a" }, { exempt: false, skipGenre: true });
  await sleep(20);
  expect(applied.at(-1)).toEqual(["1", "shown"]);
});

test("exempt は問い合わせずに shown", async () => {
  make().see({ id: "1", text: "a" }, { exempt: true, skipGenre: false });
  await sleep(20);
  expect(applied).toEqual([["1", "shown"]]);
  expect(calls).toHaveLength(0);
});

test("本文が空なら問い合わせずに unjudged", async () => {
  make().see({ id: "1", text: "" }, list);
  await sleep(20);
  expect(applied).toEqual([["1", "unjudged"]]);
  expect(calls).toHaveLength(0);
});

test("errors に入った投稿と、結果に無い投稿は unjudged", async () => {
  respond = async () => ({ results: {}, errors: { "1": "jev_failed" } });
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  t.see({ id: "2", text: "b" }, list);
  await sleep(20);
  expect(applied.slice(-2)).toEqual([["1", "unjudged"], ["2", "unjudged"]]);
});

test("classify が throw したら unjudged", async () => {
  respond = async () => { throw new Error("network"); };
  make().see({ id: "1", text: "a" }, list);
  await sleep(20);
  expect(applied.at(-1)).toEqual(["1", "unjudged"]);
});

test("タイムアウトしたら unjudged。後から来た結果は保持して次回に使う", async () => {
  respond = async (posts) => { await sleep(80); return { results: { [posts[0]!.id]: ok }, errors: {} }; };
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  await sleep(60);
  expect(applied.at(-1)).toEqual(["1", "unjudged"]);
  await sleep(50);
  t.see({ id: "1", text: "a" }, list);
  expect(applied.at(-1)).toEqual(["1", "shown"]);
  expect(calls).toHaveLength(1);
});

test("判定中の ID を二重に送らない", async () => {
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  t.see({ id: "1", text: "a" }, list);
  await sleep(20);
  expect(calls).toEqual([[{ id: "1", text: "a" }]]);
});

test("wanted の切り替えでは Verdict を保持し、再問い合わせしない", async () => {
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  await sleep(20);
  t.updateSettings({ ...settings, genres: DEFAULT_GENRES.map((g) => (g.id === "tech" ? { ...g, wanted: false } : g)) });
  t.see({ id: "1", text: "a" }, list);
  expect(applied.at(-1)).toEqual(["1", "hidden"]);
  expect(calls).toHaveLength(1);
});

test("ジャンルの説明文を変えたら Verdict を捨てて問い合わせ直す", async () => {
  const t = make();
  t.see({ id: "1", text: "a" }, list);
  await sleep(20);
  t.updateSettings({ ...settings, genres: DEFAULT_GENRES.map((g) => (g.id === "tech" ? { ...g, description: "Rust だけ" } : g)) });
  t.see({ id: "1", text: "a" }, list);
  await sleep(20);
  expect(calls).toHaveLength(2);
});
