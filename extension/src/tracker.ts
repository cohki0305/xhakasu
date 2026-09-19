import { canonical } from "../../shared/cache-key";
import { decide, type DecideSettings } from "../../shared/decide";
import { buildQuestions } from "../../shared/questions";
import type { ClassifyResponse, HideReason, PostInput, Verdict } from "../../shared/types";

export type PostState = "pending" | "shown" | "hidden" | "unjudged";
export type SeeContext = { exempt: boolean; skipGenre: boolean };
export type TrackerDeps = {
  classify(posts: PostInput[]): Promise<ClassifyResponse>;
  apply(id: string, state: PostState): void;
  onHidden(reason: HideReason): void;
};
type Options = { batchMs?: number; timeoutMs?: number; maxBatch?: number };

const questionsKey = (s: DecideSettings) => canonical(buildQuestions(s.genres));

export class Tracker {
  private verdicts = new Map<string, Verdict>();
  private contexts = new Map<string, SeeContext>();
  private inflight = new Set<string>();
  private counted = new Set<string>();
  private queue: PostInput[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private qKey: string;
  private batchMs: number;
  private timeoutMs: number;
  private maxBatch: number;

  constructor(private deps: TrackerDeps, private settings: DecideSettings, opts: Options = {}) {
    this.qKey = questionsKey(settings);
    this.batchMs = opts.batchMs ?? 150;
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.maxBatch = opts.maxBatch ?? 20;
  }

  see(post: PostInput, ctx: SeeContext): void {
    this.contexts.set(post.id, ctx);
    if (ctx.exempt) return this.deps.apply(post.id, "shown");
    if (!post.text) return this.deps.apply(post.id, "unjudged");
    const known = this.verdicts.get(post.id);
    if (known) return this.settle(post.id, known);

    this.deps.apply(post.id, "pending");
    if (this.inflight.has(post.id)) return;
    this.inflight.add(post.id);
    this.queue.push(post);
    this.timer ??= setTimeout(() => this.flush(), this.batchMs);
  }

  updateSettings(settings: DecideSettings): void {
    this.settings = settings;
    const next = questionsKey(settings);
    if (next !== this.qKey) {
      // ジャンルの定義が変わると、保持している確率は別の質問への答えになる
      this.qKey = next;
      this.verdicts.clear();
    }
  }

  private settle(id: string, verdict: Verdict): void {
    const ctx = this.contexts.get(id);
    const d = decide(verdict, this.settings, { skipGenre: ctx?.skipGenre });
    if (d.action === "hide" && !this.counted.has(id)) {
      this.counted.add(id);
      this.deps.onHidden(d.reason);
    }
    this.deps.apply(id, d.action === "hide" ? "hidden" : "shown");
  }

  private flush(): void {
    this.timer = null;
    const all = this.queue;
    this.queue = [];
    for (let i = 0; i < all.length; i += this.maxBatch) void this.send(all.slice(i, i + this.maxBatch));
  }

  private async send(batch: PostInput[]): Promise<void> {
    const sentKey = this.qKey;
    let timedOut = false;
    const timeout = new Promise<null>((r) => setTimeout(() => ((timedOut = true), r(null)), this.timeoutMs));
    const request = this.deps.classify(batch).catch(() => null);

    const first = await Promise.race([request, timeout]);
    if (timedOut) {
      for (const p of batch) this.deps.apply(p.id, "unjudged");
      // 遅れて届いた結果は捨てずに持っておく。次にその投稿が見えたとき即座に決まる
      const late = await request;
      for (const p of batch) {
        this.inflight.delete(p.id);
        const v = late?.results[p.id];
        if (v && sentKey === this.qKey) this.verdicts.set(p.id, v);
      }
      return;
    }

    for (const p of batch) {
      this.inflight.delete(p.id);
      const v = first?.results[p.id];
      if (v && sentKey === this.qKey) {
        this.verdicts.set(p.id, v);
        this.settle(p.id, v);
      } else {
        this.deps.apply(p.id, "unjudged");
      }
    }
  }
}
