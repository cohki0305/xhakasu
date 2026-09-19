import { Settings as SettingsIcon, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Settings } from "../../shared/types";
import { emptyCounts, type Counts, type RelayError } from "../src/messages";
import { loadSettings, saveSettings } from "../src/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const ERROR_TEXT: Record<RelayError, string> = {
  not_configured: "サーバー URL とアクセスキーが未設定です。設定を開いて入力してください。",
  unauthorized: "アクセスキーが違います。設定を確認してください。",
  daily_limit: "今日の判定回数の上限に達しました。明日まで、新しい投稿は未判定のまま表示されます。",
  network: "サーバーに接続できません。サーバー URL とネットワークを確認してください。",
  server: "サーバーでエラーが起きています。しばらくして直らなければ管理者に連絡してください。",
};

function Stat(props: { label: string; value: number }) {
  return (
    <div className="bg-muted/60 grid gap-0.5 rounded-lg px-3 py-2">
      <span className="text-muted-foreground text-xs">{props.label}</span>
      <span className="text-lg font-semibold tabular-nums leading-tight">{props.value}</span>
    </div>
  );
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [counts, setCounts] = useState<Counts>(emptyCounts());
  const [error, setError] = useState<RelayError | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    void chrome.storage.local.get(["counts", "lastError"]).then((local) => {
      const stored = local.counts as Counts | undefined;
      if (stored?.date === emptyCounts().date) setCounts(stored);
      const last = local.lastError as string | null | undefined;
      if (last && last in ERROR_TEXT) setError(last as RelayError);
    });
  }, []);
  if (!settings) return null;

  const setPaused = (paused: boolean) => {
    const next = { ...settings, paused };
    setSettings(next);
    void saveSettings(next);
  };
  const total = counts.genre + counts.offensive + counts.sexual;

  return (
    <main className="grid w-80 gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">xhakasu</h1>
        <Badge variant={settings.paused ? "secondary" : "default"}>{settings.paused ? "一時停止中" : "動作中"}</Badge>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-0.5">
          <Label htmlFor="paused">一時停止</Label>
          <p className="text-muted-foreground text-xs">オンの間は、すべての投稿を表示します。</p>
        </div>
        <Switch id="paused" checked={settings.paused} onCheckedChange={setPaused} />
      </div>

      <Separator />

      <section className="grid gap-2" aria-label="今日、非表示にした投稿">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">今日、非表示にした投稿</span>
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="ジャンル外" value={counts.genre} />
          <Stat label="攻撃的" value={counts.offensive} />
          <Stat label="性的" value={counts.sexual} />
        </div>
      </section>

      {error && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert />
          <AlertDescription>{ERROR_TEXT[error]}</AlertDescription>
        </Alert>
      )}

      <Button variant="outline" size="sm" onClick={() => void chrome.runtime.openOptionsPage()}>
        <SettingsIcon />
        設定を開く
      </Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
