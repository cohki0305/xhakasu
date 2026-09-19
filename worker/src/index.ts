import type { Env } from "./env";
import { handle } from "./handler";

export default {
  fetch: (req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) =>
    handle(req, env, undefined, (p) => ctx.waitUntil(p)),
};
