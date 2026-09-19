import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import { mergeSettings, validateSettings } from "./settings";

test("何も保存されていなければ初期値", () => {
  expect(mergeSettings(undefined, undefined)).toEqual(DEFAULT_SETTINGS);
});

test("保存された値で上書きし、アクセスキーは local から取る", () => {
  const s = mergeSettings({ strictness: "strict", hideSexual: false, relayUrl: "https://r.workers.dev" }, "pw");
  expect(s.strictness).toBe("strict");
  expect(s.hideSexual).toBe(false);
  expect(s.relayUrl).toBe("https://r.workers.dev");
  expect(s.accessKey).toBe("pw");
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

test("非表示の見せ方は初期値がバー。remove は保持し、壊れた値はバーに戻す", () => {
  expect(mergeSettings(undefined, undefined).hiddenStyle).toBe("bar");
  expect(mergeSettings({ hiddenStyle: "remove" }, "").hiddenStyle).toBe("remove");
  expect(mergeSettings({ hiddenStyle: "blur" }, "").hiddenStyle).toBe("bar");
});

test("壊れた値は初期値で埋める", () => {
  const s = mergeSettings({ strictness: "extreme", genres: "x", paused: "yes" }, 123);
  expect(s.strictness).toBe("normal");
  expect(s.genres).toEqual(DEFAULT_SETTINGS.genres);
  expect(s.paused).toBe(false);
  expect(s.accessKey).toBe("");
});

test("保存前の入力チェック", () => {
  const ok = { ...DEFAULT_SETTINGS, relayUrl: "https://x.workers.dev", accessKey: "k" };
  expect(validateSettings(ok)).toBeNull();
  expect(validateSettings({ ...ok, relayUrl: "" })).toBeNull(); // 未設定のままの保存は許す（ポップアップが案内する）
  expect(validateSettings({ ...ok, relayUrl: "x.workers.dev" })).toBe("サーバー URL は https:// から始まる形で入力してください。");
  const blank = { ...ok, genres: [{ id: "g1", name: " ", description: "x", wanted: true }, ...ok.genres] };
  expect(validateSettings(blank)).toBe("名前か説明文が空のジャンルがあります。入力するか削除してください。");
});
