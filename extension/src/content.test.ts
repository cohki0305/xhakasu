// content.ts を X の DOM を模したページで丸ごと動かす結合テスト。
// content.ts は import した時点で start() するので、シナリオは 1 本にまとめてある。
import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { ClassifyReply, Msg } from "./messages";
import type { Verdict } from "../../shared/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tweet = (handle: string, id: string, text: string) => `
  <div data-testid="cellInnerDiv" id="cell-${id}">
    <article data-testid="tweet">
      <a href="/${handle}/status/${id}"><time>1h</time></a>
      ${text ? `<div data-testid="tweetText">${text}</div>` : ""}
    </article>
  </div>`;

const VERDICTS: Record<string, Verdict> = {
  テックの話: { genre: { tech: 1 }, offensive: 0, sexual: 0 },
  政治の話: { genre: { politics: 1 }, offensive: 0, sexual: 0 },
  自分の政治の話: { genre: { politics: 1 }, offensive: 0, sexual: 0 },
};

test("判定して非表示にし、枠の使い回しと一時停止で印を外す", async () => {
  const win = new Window({ url: "https://x.com/home" });
  win.document.body.innerHTML =
    `<a data-testid="AppTabBar_Profile_Link" href="/me">Profile</a>` +
    tweet("mika", "1", "テックの話") +
    tweet("seiji", "2", "政治の話") +
    tweet("neko", "3", "") +
    tweet("me", "4", "自分の政治の話");

  const sent: Msg[] = [];
  let stored: Record<string, unknown> = { relayUrl: "https://r.workers.dev" };
  let onChanged: (changes: Record<string, unknown>) => void = () => {};
  const chromeStub = {
    storage: {
      sync: { get: async () => ({ settings: stored }) },
      local: { get: async () => ({ accessKey: "pw" }) },
      onChanged: { addListener: (fn: typeof onChanged) => (onChanged = fn) },
    },
    runtime: {
      sendMessage: async (msg: Msg): Promise<ClassifyReply | undefined> => {
        sent.push(msg);
        if (msg.type !== "classify") return undefined;
        const results = Object.fromEntries(msg.posts.map((p) => [p.id, VERDICTS[p.text]!]));
        return { ok: true, body: { results, errors: {} } };
      },
    },
  };
  Object.assign(globalThis, {
    document: win.document,
    location: win.location,
    MutationObserver: win.MutationObserver,
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
    chrome: chromeStub,
  });
  const state = (id: string) => win.document.getElementById(`cell-${id}`)!.getAttribute("data-xhk-state");

  await import("./content");
  await sleep(10);
  expect(state("1")).toBe("pending");
  expect(state("3")).toBe("unjudged"); // 本文なしは問い合わせない
  expect(state("4")).toBeNull(); // 自分の投稿は判定しない

  await sleep(250);
  expect(state("1")).toBeNull();
  expect(state("2")).toBe("hidden");
  const classified = sent.filter((m) => m.type === "classify");
  expect(classified).toHaveLength(1);
  expect(classified[0]!.type === "classify" && classified[0]!.posts.map((p) => p.id)).toEqual(["1", "2"]);
  expect(sent.filter((m) => m.type === "count")).toEqual([{ type: "count", reason: "genre" }]);

  // X が枠を使い回し、非表示だった枠から投稿が抜けた
  win.document.getElementById("cell-2")!.innerHTML = "<div>さらに表示</div>";
  await sleep(30);
  expect(state("2")).toBeNull();

  // 同じ枠に別の投稿が入った
  win.document.getElementById("cell-2")!.innerHTML = `<article data-testid="tweet"><a href="/mika/status/5"><time>1m</time></a><div data-testid="tweetText">テックの話</div></article>`;
  await sleep(250);
  expect(state("2")).toBeNull();

  // 一時停止で、残っている印をすべて外す
  stored = { ...stored, paused: true };
  onChanged({ settings: {} });
  await sleep(30);
  expect(win.document.querySelectorAll("[data-xhk-state]").length).toBe(0);
});
