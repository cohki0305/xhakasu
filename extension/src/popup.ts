import { emptyCounts, type Counts, type RelayError } from "./messages";
import { loadSettings, saveSettings } from "./settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ERROR_TEXT: Record<RelayError, string> = {
  not_configured: "受付 URL とアクセスキーが未設定です。設定を開いて入力してください。",
  unauthorized: "アクセスキーが違います。設定を確認してください。",
  daily_limit: "今日の判定回数の上限に達しました。明日まで、新しい投稿は未判定のまま表示されます。",
  network: "受付に接続できません。受付 URL とネットワークを確認してください。",
  server: "受付でエラーが起きています。しばらくして直らなければ管理者に連絡してください。",
};

async function init(): Promise<void> {
  const settings = await loadSettings();
  const paused = $<HTMLInputElement>("paused");
  paused.checked = settings.paused;
  paused.onchange = () => void saveSettings({ ...settings, paused: paused.checked });

  const local = await chrome.storage.local.get(["counts", "lastError"]);
  const counts = local.counts as Counts | undefined;
  const lastError = local.lastError as string | null | undefined;
  const fresh = emptyCounts();
  const c: Counts = counts?.date === fresh.date ? counts : fresh;
  $("genre").textContent = String(c.genre);
  $("offensive").textContent = String(c.offensive);
  $("sexual").textContent = String(c.sexual);
  $("total").textContent = String(c.genre + c.offensive + c.sexual);

  const err = $("error");
  if (lastError && lastError in ERROR_TEXT) {
    err.textContent = ERROR_TEXT[lastError as RelayError];
    err.hidden = false;
  }
  $("openOptions").onclick = (e) => {
    e.preventDefault();
    void chrome.runtime.openOptionsPage();
  };
}

void init();
