import { buildQuestions } from "../../shared/questions";
import type { ClassifyResponse, PostInput } from "../../shared/types";
import { emptyCounts, type ClassifyReply, type Counts, type Msg, type RelayError } from "./messages";
import { loadSettings } from "./settings";

async function classify(posts: PostInput[]): Promise<ClassifyReply> {
  const s = await loadSettings();
  if (!s.relayUrl || !s.passphrase) return { ok: false, error: "not_configured" };
  let res: Response;
  try {
    // 受付 URL が URL として壊れていると new URL が throw する。これも network 扱いにする
    res = await fetch(new URL("/classify", s.relayUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${s.passphrase}`, "Content-Type": "application/json" },
      body: JSON.stringify({ questions: buildQuestions(s.genres), posts }),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (res.status === 401) return { ok: false, error: "unauthorized" };
  if (res.status === 429) return { ok: false, error: "daily_limit" };
  if (!res.ok) return { ok: false, error: "server" };
  const body = (await res.json()) as ClassifyResponse;
  const limited = Object.values(body.errors).includes("daily_limit");
  await chrome.storage.local.set({ lastError: limited ? "daily_limit" : null });
  return { ok: true, body };
}

// 件数の更新は 1 本の鎖に並べる。同時に届いた count メッセージで読み書きが競合しないようにする
let chain: Promise<void> = Promise.resolve();
function addCount(reason: keyof Omit<Counts, "date">): void {
  chain = chain.then(async () => {
    const stored = (await chrome.storage.local.get("counts")).counts as Counts | undefined;
    const fresh = emptyCounts();
    const c: Counts = stored?.date === fresh.date ? stored : fresh;
    c[reason] += 1;
    await chrome.storage.local.set({ counts: c });
  });
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.type === "count") {
    addCount(msg.reason);
    return false;
  }
  classify(msg.posts).then(async (reply) => {
    if (!reply.ok) await chrome.storage.local.set({ lastError: reply.error satisfies RelayError });
    sendResponse(reply);
  });
  return true; // 非同期で sendResponse する
});
