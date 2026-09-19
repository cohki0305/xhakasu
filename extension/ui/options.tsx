import { Check, KeyRound, Plus, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { OTHER_ID } from "../../shared/defaults";
import type { Genre, HiddenStyle, Settings, Strictness } from "../../shared/types";
import { loadSettings, saveSettings, validateSettings } from "../src/settings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const MAX_GENRES = 20;

const STRICTNESS: { value: Strictness; title: string; note: string }[] = [
  { value: "loose", title: "ゆるめ", note: "確信が強いときだけ非表示にする。見逃しは増えるが、巻き添えは減る。" },
  { value: "normal", title: "ふつう", note: "迷ったらこれ。" },
  { value: "strict", title: "きびしめ", note: "疑わしければ非表示にする。巻き添えは増える。" },
];

const HIDDEN_STYLE: { value: HiddenStyle; title: string; note: string }[] = [
  { value: "bar", title: "バーを残す", note: "理由と確率を書いた細いバーに置き換える。バーを押すとその場で中身を見られるので、判定の精度を確かめられる。" },
  { value: "remove", title: "完全に消す", note: "跡を残さず消す。判定に納得してから選ぶのがおすすめ。" },
];

function OptionRow(props: { id: string; value: string; title: string; note: string }) {
  return (
    <Label
      htmlFor={props.id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
    >
      <RadioGroupItem id={props.id} value={props.value} className="mt-0.5" />
      <span className="grid gap-1">
        <span className="font-medium leading-none">{props.title}</span>
        <span className="text-muted-foreground text-sm leading-relaxed">{props.note}</span>
      </span>
    </Label>
  );
}

function ToggleRow(props: { id: string; title: string; note: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="grid gap-1">
        <Label htmlFor={props.id}>{props.title}</Label>
        <p className="text-muted-foreground text-sm">{props.note}</p>
      </div>
      <Switch id={props.id} checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => void loadSettings().then(setSettings), []);
  if (!settings) return null;

  const patch = (p: Partial<Settings>) => {
    setSettings({ ...settings, ...p });
    setMessage(null);
  };
  const patchGenre = (i: number, p: Partial<Genre>) =>
    patch({ genres: settings.genres.map((g, k) => (k === i ? { ...g, ...p } : g)) });
  const addGenre = () => {
    const genre: Genre = { id: `g_${Date.now().toString(36)}`, name: "", description: "", wanted: true };
    patch({ genres: [...settings.genres.slice(0, -1), genre, settings.genres.at(-1)!] }); // 「その他」は常に末尾
  };
  const save = async () => {
    const trimmed = { ...settings, relayUrl: settings.relayUrl.trim() };
    const error = validateSettings(trimmed);
    if (error) return setMessage({ kind: "error", text: error });
    await saveSettings(trimmed);
    setSettings(trimmed);
    setMessage({ kind: "ok", text: "保存しました。開いている X のタブにすぐ反映されます。" });
  };

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-6 pt-10 pb-28">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">xhakasu</h1>
        <p className="text-muted-foreground text-sm">X のタイムラインを意味で仕分けて、見たい投稿だけを残します。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>見たいジャンル</CardTitle>
          <CardDescription>
            オンにしたジャンルの投稿だけを表示します。説明文はそのまま判定に使われるので、具体的に書くほど当たります。オフのジャンルも消さずに残しておくと、判定が「どれでもない投稿」をそこへ正しく振り分けられます。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {settings.genres.map((g, i) => (
            <div key={g.id} className="flex items-center gap-3">
              <Switch
                id={`wanted-${g.id}`}
                checked={g.wanted}
                onCheckedChange={(wanted) => patchGenre(i, { wanted })}
                aria-label={`${g.name || "新しいジャンル"} を表示する`}
              />
              <Input
                id={`name-${g.id}`}
                className="w-40 shrink-0"
                value={g.name}
                maxLength={30}
                placeholder="ジャンル名"
                aria-label="ジャンル名"
                onChange={(e) => patchGenre(i, { name: e.target.value })}
              />
              <Input
                id={`desc-${g.id}`}
                className="min-w-0 flex-1"
                value={g.description}
                maxLength={200}
                placeholder="例: トレーニング、HYROX、ランニング、栄養"
                aria-label={`${g.name || "新しいジャンル"} の説明文`}
                onChange={(e) => patchGenre(i, { description: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground shrink-0"
                disabled={g.id === OTHER_ID}
                aria-label={`${g.name || "新しいジャンル"} を削除`}
                title={g.id === OTHER_ID ? "「その他」は削除できません" : "削除"}
                onClick={() => patch({ genres: settings.genres.filter((_, k) => k !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <div>
            <Button variant="outline" size="sm" onClick={addGenre} disabled={settings.genres.length >= MAX_GENRES}>
              <Plus />
              ジャンルを追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>非表示にする投稿</CardTitle>
          <CardDescription>ジャンルに関係なく、内容で非表示にします。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <ToggleRow
            id="hideOffensive"
            title="攻撃的な投稿を非表示にする"
            note="特定の人や集団への罵倒、侮辱、脅しを含む投稿。"
            checked={settings.hideOffensive}
            onChange={(hideOffensive) => patch({ hideOffensive })}
          />
          <Separator />
          <ToggleRow
            id="hideSexual"
            title="性的な投稿を非表示にする"
            note="性的な内容や、性的なコンテンツへ誘導する投稿。画像だけの投稿は判定できません。"
            checked={settings.hideSexual}
            onChange={(hideSexual) => patch({ hideSexual })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>非表示にした投稿の見せ方</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={settings.hiddenStyle} onValueChange={(v) => patch({ hiddenStyle: v as HiddenStyle })} className="grid gap-3">
            {HIDDEN_STYLE.map((o) => (
              <OptionRow key={o.value} id={`hiddenStyle-${o.value}`} {...o} />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>判定の厳しさ</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={settings.strictness} onValueChange={(v) => patch({ strictness: v as Strictness })} className="grid gap-3 sm:grid-cols-3">
            {STRICTNESS.map((o) => (
              <OptionRow key={o.value} id={`strictness-${o.value}`} {...o} />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>接続</CardTitle>
          <CardDescription>判定を行うサーバーの URL と、あなた用のアクセスキーです。どちらも管理者から受け取ります。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="relayUrl">
              <Server className="size-4" />
              サーバー URL
            </Label>
            <Input id="relayUrl" type="url" value={settings.relayUrl} placeholder="https://xhakasu-relay.example.workers.dev" onChange={(e) => patch({ relayUrl: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accessKey">
              <KeyRound className="size-4" />
              アクセスキー
            </Label>
            <Input id="accessKey" type="password" autoComplete="off" value={settings.accessKey} onChange={(e) => patch({ accessKey: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="bg-background/80 fixed inset-x-0 bottom-0 border-t backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3">
          <Button onClick={() => void save()}>保存</Button>
          <div role="status" className="min-w-0 flex-1 text-sm">
            {message?.kind === "ok" && (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Check className="size-4" />
                {message.text}
              </span>
            )}
            {message?.kind === "error" && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
