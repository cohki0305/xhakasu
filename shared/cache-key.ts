import type { Questions } from "./types";

/** キーを辞書順に並べた JSON。オブジェクトの書き順で鍵が割れないようにする */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export async function cacheKey(text: string, questions: Questions): Promise<string> {
  const data = new TextEncoder().encode(`${normalizeText(text)}\n${canonical(questions)}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
