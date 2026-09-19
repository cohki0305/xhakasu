import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import { mergeSettings } from "./settings";

test("何も保存されていなければ初期値", () => {
  expect(mergeSettings(undefined, undefined)).toEqual(DEFAULT_SETTINGS);
});

test("保存された値で上書きし、合言葉は local から取る", () => {
  const s = mergeSettings({ strictness: "strict", hideSexual: false, relayUrl: "https://r.workers.dev" }, "pw");
  expect(s.strictness).toBe("strict");
  expect(s.hideSexual).toBe(false);
  expect(s.relayUrl).toBe("https://r.workers.dev");
  expect(s.passphrase).toBe("pw");
  expect(s.hideOffensive).toBe(true);
});

test("other が消えていたら末尾に足し、途中にあれば末尾へ移す", () => {
  const tech = { id: "tech", name: "テック", description: "開発", wanted: true };
  const other = { id: "other", name: "その他", description: "どれでもない", wanted: false };
  expect(mergeSettings({ genres: [tech] }, "").genres.map((g) => g.id)).toEqual(["tech", "other"]);
  const moved = mergeSettings({ genres: [other, tech] }, "").genres;
  expect(moved.map((g) => g.id)).toEqual(["tech", "other"]);
  expect(moved[1]!.wanted).toBe(false);
});

test("壊れた値は初期値で埋める", () => {
  const s = mergeSettings({ strictness: "extreme", genres: "x", paused: "yes" }, 123);
  expect(s.strictness).toBe("normal");
  expect(s.genres).toEqual(DEFAULT_SETTINGS.genres);
  expect(s.paused).toBe(false);
  expect(s.passphrase).toBe("");
});
