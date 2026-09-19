import { cacheKey } from "../../shared/cache-key";
import type { ClassifyResponse, Verdict } from "../../shared/types";
import type { Env } from "./env";
import { JEV_MODEL, toVerdict } from "./jev";
import { parseRequest } from "./validate";

const CACHE_TTL = 60 * 60 * 24 * 30;
const COUNT_TTL = 60 * 60 * 24 * 2;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const utcDate = () => new Date().toISOString().slice(0, 10);

export async function handle(req: Request, env: Env, today: () => string = utcDate): Promise<Response> {
  const url = new URL(req.url);
  if (req.method !== "POST" || url.pathname !== "/classify") return json(404, { error: "not_found" });

  // 1. 合言葉
  const pass = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  const holderRaw = pass ? await env.KV.get(`pass:${pass}`) : null;
  if (!holderRaw) return json(401, { error: "unauthorized" });
  const holder = JSON.parse(holderRaw) as { name: string; dailyLimit: number };

  // 2. 検証
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const parsed = parseRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const { questions, posts } = parsed.value;

  // 3. 台帳
  const out: ClassifyResponse = { results: {}, errors: {} };
  const misses: { id: string; text: string; key: string }[] = [];
  await Promise.all(
    posts.map(async (p) => {
      const key = await cacheKey(p.text, questions);
      const hit = await env.KV.get(`cache:${key}`);
      if (hit) out.results[p.id] = JSON.parse(hit) as Verdict;
      else misses.push({ ...p, key });
    }),
  );
  misses.sort((a, b) => posts.findIndex((p) => p.id === a.id) - posts.findIndex((p) => p.id === b.id));

  // 4. 1 日上限（KV なので数件ずれうる。目的は暴走の防止）
  const countKey = `count:${holder.name}:${today()}`;
  const used = Number((await env.KV.get(countKey)) ?? "0");
  const allowed = Math.max(0, holder.dailyLimit - used);
  const toAsk = misses.slice(0, allowed);
  for (const m of misses.slice(allowed)) out.errors[m.id] = "daily_limit";
  if (misses.length > 0 && toAsk.length === 0 && Object.keys(out.results).length === 0) {
    return json(429, { error: "daily_limit" });
  }
  if (toAsk.length > 0) await env.KV.put(countKey, String(used + toAsk.length), { expirationTtl: COUNT_TTL });

  // 5. Jev（台帳にない分だけ、並列）
  await Promise.all(
    toAsk.map(async (m) => {
      try {
        const verdict = toVerdict(await env.AI.run(JEV_MODEL, { state: m.text, questions }));
        out.results[m.id] = verdict;
        await env.KV.put(`cache:${m.key}`, JSON.stringify(verdict), { expirationTtl: CACHE_TTL });
      } catch {
        out.errors[m.id] = "jev_failed";
      }
    }),
  );

  // posts の順に並べ直して返す（テストと読みやすさのため）
  const ordered: ClassifyResponse = { results: {}, errors: out.errors };
  for (const p of posts) if (out.results[p.id]) ordered.results[p.id] = out.results[p.id]!;
  return json(200, ordered);
}
