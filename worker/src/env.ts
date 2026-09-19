// Cloudflare の型に依存しない最小の形。本物の KV / AI binding は構造的にこれを満たす。
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
export interface AiLike {
  run(model: string, input: unknown): Promise<unknown>;
}
export interface Env {
  AI: AiLike;
  KV: KVLike;
}
