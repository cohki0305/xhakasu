import type { ClassifyResponse, HideReason, PostInput } from "../../shared/types";

export type Msg = { type: "classify"; posts: PostInput[] } | { type: "count"; reason: HideReason };
export type RelayError = "not_configured" | "unauthorized" | "daily_limit" | "network" | "server";
export type ClassifyReply = { ok: true; body: ClassifyResponse } | { ok: false; error: RelayError };
export type Counts = { date: string; genre: number; offensive: number; sexual: number };

export const todayLocal = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
export const emptyCounts = (): Counts => ({ date: todayLocal(), genre: 0, offensive: 0, sexual: 0 });
