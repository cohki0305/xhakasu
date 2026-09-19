import type { Env } from "./env";
import { handle } from "./handler";

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
};
