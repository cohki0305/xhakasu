import { DEFAULT_GENRES, DEFAULT_SETTINGS, OTHER_ID } from "../../shared/defaults";
import type { Genre, Settings, Strictness } from "../../shared/types";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isGenre = (v: unknown): v is Genre =>
  isObj(v) && typeof v.id === "string" && typeof v.name === "string" && typeof v.description === "string" && typeof v.wanted === "boolean";

function fixGenres(v: unknown): Genre[] {
  if (!Array.isArray(v) || !v.every(isGenre) || v.length === 0) return DEFAULT_GENRES;
  const other = v.find((g) => g.id === OTHER_ID) ?? DEFAULT_GENRES.find((g) => g.id === OTHER_ID)!;
  return [...v.filter((g) => g.id !== OTHER_ID), other];
}

export function mergeSettings(sync: unknown, local: unknown): Settings {
  const s = isObj(sync) ? sync : {};
  const bool = (k: keyof Settings) => (typeof s[k] === "boolean" ? (s[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean));
  const strict = ["loose", "normal", "strict"].includes(s.strictness as string) ? (s.strictness as Strictness) : DEFAULT_SETTINGS.strictness;
  return {
    genres: fixGenres(s.genres),
    hideOffensive: bool("hideOffensive"),
    hideSexual: bool("hideSexual"),
    strictness: strict,
    hiddenStyle: s.hiddenStyle === "remove" ? "remove" : "bar",
    relayUrl: typeof s.relayUrl === "string" ? s.relayUrl : "",
    accessKey: typeof local === "string" ? local : "",
    paused: bool("paused"),
  };
}

/** 保存してよければ null、だめなら利用者に見せる文言を返す */
export function validateSettings(s: Settings): string | null {
  if (s.genres.some((g) => !g.name.trim() || !g.description.trim())) {
    return "名前か説明文が空のジャンルがあります。入力するか削除してください。";
  }
  if (s.relayUrl && !/^https:\/\/\S+$/.test(s.relayUrl)) return "サーバー URL は https:// から始まる形で入力してください。";
  return null;
}

export async function loadSettings(): Promise<Settings> {
  const [sync, local] = await Promise.all([chrome.storage.sync.get("settings"), chrome.storage.local.get("accessKey")]);
  return mergeSettings(sync.settings, local.accessKey);
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { accessKey, ...rest } = settings;
  await Promise.all([chrome.storage.sync.set({ settings: rest }), chrome.storage.local.set({ accessKey })]);
}
