import type { Verdict } from "../../shared/types";

export const JEV_MODEL = "typesafe/jev";

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object";

/** binding は { answers } を直接返し、REST は { result: { answers } } で包む。両方受ける */
export function toVerdict(raw: unknown): Verdict {
  const body = isObj(raw) && isObj(raw.result) ? raw.result : raw;
  const a = isObj(body) ? body.answers : undefined;
  const genre = a?.genre?.probabilities;
  const offensive = a?.offensive?.noul;
  const sexual = a?.sexual?.noul;
  if (!isObj(genre) || typeof offensive !== "number" || typeof sexual !== "number") {
    throw new Error("jev_bad_shape");
  }
  return { genre: genre as Record<string, number>, offensive, sexual };
}
