import { beforeEach, expect, test } from "bun:test";
import { cacheKey } from "../../shared/cache-key";
import { DEFAULT_GENRES } from "../../shared/defaults";
import { buildQuestions } from "../../shared/questions";
import type { ClassifyResponse } from "../../shared/types";
import type { Env } from "./env";
import { handle } from "./handler";

const questions = buildQuestions(DEFAULT_GENRES);
const jevAnswer = { answers: { genre: { probabilities: { tech: 1 } }, offensive: { noul: 0.1 }, sexual: { noul: 0 } } };

let store: Map<string, string>;
let aiCalls: unknown[];
let env: Env;

beforeEach(() => {
  store = new Map([["key:secret", JSON.stringify({ name: "koki", dailyLimit: 3 })]]);
  aiCalls = [];
  env = {
    KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) },
    AI: { run: async (_m, input) => (aiCalls.push(input), jevAnswer) },
  };
});

const post = (posts: { id: string; text: string }[], accessKey = "secret") =>
  handle(
    new Request("https://relay.example/classify", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ questions, posts }),
    }),
    env,
    () => "2026-09-19",
  );

test("アクセスキーが違えば 401、Jev は呼ばない", async () => {
  const res = await post([{ id: "1", text: "a" }], "wrong");
  expect(res.status).toBe(401);
  expect(aiCalls).toHaveLength(0);
});

test("POST /classify 以外は 404", async () => {
  const res = await handle(new Request("https://relay.example/", { method: "GET" }), env);
  expect(res.status).toBe(404);
});

test("壊れた本文は 400", async () => {
  const res = await handle(
    new Request("https://relay.example/classify", { method: "POST", headers: { Authorization: "Bearer secret" }, body: "{" }),
    env,
  );
  expect(res.status).toBe(400);
});

test("Jev を呼んで Verdict を返し、台帳と件数に書く", async () => {
  const res = await post([{ id: "1", text: "こんにちは" }]);
  expect(res.status).toBe(200);
  const body = (await res.json()) as ClassifyResponse;
  expect(body.results["1"]).toEqual({ genre: { tech: 1 }, offensive: 0.1, sexual: 0 });
  expect(aiCalls).toEqual([{ state: "こんにちは", questions }]);
  expect(store.get(`cache:${await cacheKey("こんにちは", questions)}`)).toBe(JSON.stringify(body.results["1"]));
  expect(store.get("count:koki:2026-09-19")).toBe("1");
});

test("台帳にあれば Jev を呼ばず、件数も増やさない", async () => {
  await post([{ id: "1", text: "同じ文" }]);
  await post([{ id: "2", text: "同じ文" }]);
  expect(aiCalls).toHaveLength(1);
  expect(store.get("count:koki:2026-09-19")).toBe("1");
});

test("上限を超える分だけ daily_limit で返す", async () => {
  const res = await post([1, 2, 3, 4, 5].map((n) => ({ id: String(n), text: `文${n}` })));
  const body = (await res.json()) as ClassifyResponse;
  expect(res.status).toBe(200);
  expect(Object.keys(body.results)).toEqual(["1", "2", "3"]);
  expect(body.errors).toEqual({ "4": "daily_limit", "5": "daily_limit" });
  expect(aiCalls).toHaveLength(3);
});

test("上限に達していて台帳ヒットもなければ 429", async () => {
  store.set("count:koki:2026-09-19", "3");
  const res = await post([{ id: "1", text: "新しい文" }]);
  expect(res.status).toBe(429);
});

test("上限に達していても台帳ヒットは返す", async () => {
  await post([{ id: "1", text: "既知" }]);
  store.set("count:koki:2026-09-19", "3");
  const res = await post([{ id: "2", text: "既知" }, { id: "3", text: "未知" }]);
  const body = (await res.json()) as ClassifyResponse;
  expect(res.status).toBe(200);
  expect(Object.keys(body.results)).toEqual(["2"]);
  expect(body.errors).toEqual({ "3": "daily_limit" });
});

test("Jev が 1 件失敗しても他は返す", async () => {
  env.AI.run = async (_m, input: any) => {
    if (input.state === "bad") throw new Error("boom");
    return jevAnswer;
  };
  const res = await post([{ id: "1", text: "ok" }, { id: "2", text: "bad" }]);
  const body = (await res.json()) as ClassifyResponse;
  expect(Object.keys(body.results)).toEqual(["1"]);
  expect(body.errors).toEqual({ "2": "jev_failed" });
});
