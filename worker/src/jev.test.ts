import { expect, test } from "bun:test";
import { toVerdict } from "./jev";

const answers = {
  genre: { type: "choice", choice: "tech", confidence: 0.99, probabilities: { tech: 0.87, other: 0.13 } },
  offensive: { type: "noul", noul: 0.83 },
  sexual: { type: "noul", noul: 0.01 },
};

test("binding の返り値（answers が直下）を詰め直す", () => {
  expect(toVerdict({ model: "jev-1.13.0", answers })).toEqual({ genre: { tech: 0.87, other: 0.13 }, offensive: 0.83, sexual: 0.01 });
});

test("REST の返り値（result の下）も受ける", () => {
  expect(toVerdict({ state: "Completed", result: { answers } }).offensive).toBe(0.83);
});

test("形が違えば throw", () => {
  expect(() => toVerdict({ answers: { genre: {} } })).toThrow();
  expect(() => toVerdict(null)).toThrow();
});
