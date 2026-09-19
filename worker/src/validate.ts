import type { ClassifyRequest } from "../../shared/types";

type Result = { ok: true; value: ClassifyRequest } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length >= 1 && v.length <= max;

function isNoul(q: unknown): boolean {
  return isObj(q) && q.type === "noul" && isText(q.instructions, 300) && Object.keys(q).length === 2;
}

export function parseRequest(body: unknown): Result {
  if (!isObj(body) || !isObj(body.questions) || !Array.isArray(body.posts)) return fail("bad_shape");

  const q = body.questions;
  if (Object.keys(q).sort().join() !== "genre,offensive,sexual") return fail("bad_questions");
  if (!isNoul(q.offensive) || !isNoul(q.sexual)) return fail("bad_noul");
  const g = q.genre;
  if (!isObj(g) || g.type !== "choice" || !isText(g.instructions, 300) || !isObj(g.criteria)) return fail("bad_genre");
  const entries = Object.entries(g.criteria);
  if (entries.length > 20 || !("other" in g.criteria)) return fail("bad_genre_criteria");
  if (!entries.every(([k, v]) => isText(k, 40) && isText(v, 200))) return fail("bad_genre_criteria");

  if (body.posts.length < 1 || body.posts.length > 20) return fail("bad_posts_count");
  for (const p of body.posts) {
    if (!isObj(p) || typeof p.id !== "string" || !/^\d{1,25}$/.test(p.id) || !isText(p.text, 4000)) return fail("bad_post");
  }
  return { ok: true, value: body as unknown as ClassifyRequest };
}
