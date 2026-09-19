# xhakasu 設計書

- 承認済み提案: https://claude.ai/artifact/Q5X6vAMPYsk8Fv8RdjSCVA （2026-09-19 承認）
- 対象: X（x.com）のタイムラインを意味で仕分ける Chrome 拡張と、その中継 Worker

## 目的

見たいジャンルの投稿だけをタイムラインに残す。オプションで、攻撃的な投稿と性的な投稿を非表示にする。判定には Cloudflare Workers AI の分類モデル `typesafe/jev` を使う。

## 前提

- 利用者は Koki さんと、zip を渡す数人。Chrome ウェブストアには出さない。
- Cloudflare の利用料は Koki さんのアカウントが持つ。
- PC の Chrome だけを対象にする。

## 全体構成

```
x.com のページ
  └ content script   投稿の検出・判定待ちの薄隠し・非表示
       │ chrome.runtime.sendMessage
  background         束ねた投稿を Worker へ POST、設定の読み出し
       │ HTTPS + 合言葉
  中継 Worker        合言葉の確認 → KV 台帳 → 1 日上限 → Jev 呼び出し
       │ env.AI.run('typesafe/jev', …)
  typesafe/jev
```

API トークンは拡張に入れない。Worker の AI binding を使うので、トークン自体が Worker のコードにも現れない。

## リポジトリ構成

| 場所 | 役割 |
|---|---|
| `shared/` | 拡張と Worker の両方が使う純粋関数。質問の組み立て、判定ルール、台帳の鍵 |
| `extension/` | Manifest V3 の Chrome 拡張 |
| `worker/` | 中継 Worker（wrangler） |

言語は TypeScript、ビルドとテストは bun。設定画面とポップアップはフレームワークなしの HTML。

## shared/

### 設定の型

```ts
type Genre = { id: string; name: string; description: string; wanted: boolean }
type Settings = {
  genres: Genre[]            // 「other」は常に末尾に存在し、削除できない
  hideOffensive: boolean
  hideSexual: boolean
  strictness: 'loose' | 'normal' | 'strict'
  relayUrl: string
  passphrase: string
  paused: boolean
}
```

初期ジャンル: テック/AI、ビジネス、フィットネス、政治、エンタメ、スポーツ、その他。初期状態で `wanted` なのはテック/AI、フィットネス、その他。利用者は名前と説明文を書いてジャンルを足せる。

### 質問の組み立て `buildQuestions(settings)`

1 投稿につき Jev を 1 回呼び、次の 3 問を聞く。

- `genre`: `choice`。`criteria` は全ジャンル（見たくないものも含む）の `id → description`。`other` を必ず含める。多択は必ずどれかを選ばせるので、見たいジャンルだけを並べると無関係な投稿が通ってしまう。
- `offensive`: `noul`。特定の人や集団への罵倒・侮辱・脅しを含むか。
- `sexual`: `noul`。性的な内容、または性的なコンテンツへの誘導を含むか。

`hideOffensive` / `hideSexual` がオフでも 3 問とも聞く。設定を切り替えた瞬間に再判定なしで反映でき、台帳の鍵も割れない。

### 判定ルール `decide(answers, settings)`

戻り値は `{ action: 'show' } | { action: 'hide'; reason: 'genre' | 'offensive' | 'sexual' }`。

- 性的 → 攻撃的 → ジャンル の順に評価する。
- 閾値は `strictness` から引く。初期値は攻撃的・性的が 0.85 / 0.70 / 0.50、ジャンルは「見たいジャンルの確率の合計」が 0.30 / 0.50 / 0.70 未満なら非表示。
- この関数の本体は Koki さんが書く（枠とテストは用意する）。上の初期値はテストの期待値として置くが、試し打ちの結果を見て動かしてよい。

### 台帳の鍵 `cacheKey(text, questions)`

`sha256(正規化した本文 + "\n" + 質問セットの正準 JSON)`。正規化は前後の空白除去と連続空白の圧縮だけ。URL や絵文字は残す。

## extension/

### 投稿の検出

- `MutationObserver` で `article[data-testid="tweet"]` の出現を監視する。
- X の DOM に依存するセレクタと抽出処理は `extension/src/x-dom.ts` の 1 ファイルに集める。抽出するのは投稿 ID（`a[href*="/status/"]` の末尾の数字）、本文（`[data-testid="tweetText"]`）、投稿者のハンドル。
- X は画面外に出た投稿の表示枠を再利用する。判定結果は DOM ではなく**投稿 ID** をキーにしたメモリ上の Map に持ち、枠に入っている投稿 ID が変わったら状態を付け直す。

### 状態

投稿 ID ごとに `pending → shown | hidden | unjudged`。

- `pending`: 本文を半透明＋ぼかしにする。
- `shown`: 通常表示。
- `hidden`: 投稿 1 件を包む外側の枠（`[data-testid="cellInnerDiv"]`）を `display: none` にする。跡は残さず、開き直す手段も置かない。
- `unjudged`: 通常表示に戻し、小さく「未判定」と付ける。

`hidden` にしたとき X が高さを測り直して詰めるかは実機で確かめる。詰まらない場合は高さ 0 ＋ `overflow: hidden` に切り替える。

### 束ねて送る

出現した投稿を 150 ms 溜め、最大 20 件を 1 回で background に渡す。background が Worker に POST する。投稿 ID ごとの結果は Map に入れ、スクロールで戻ってきた投稿は問い合わせない。

### 判定しないもの

- 自分の投稿（ログイン中のハンドルと一致するもの。ハンドルは左メニューのプロフィールリンク `a[data-testid="AppTabBar_Profile_Link"]` から `x-dom.ts` が読む。読めなければ判定対象に含める）
- 個別ページ（`/<user>/status/<id>`）で開いた投稿そのもの
- 個別ページの返信欄はジャンル判定を適用しない（攻撃的・性的だけ見る）
- 通知、DM、プロフィールのヘッダー
- 本文が空の投稿（画像だけ）は `unjudged`

### 失敗時

4 秒でタイムアウト。通信失敗、401、429（上限到達）、Worker のエラーはすべて `unjudged` にする。隠したまま固まらせない。401 と 429 はポップアップに理由を出す。

### 設定画面とポップアップ

- 設定画面（options）: ジャンルの追加・編集・削除と `wanted` の切り替え、非表示オプション 2 つ（「攻撃的な投稿を非表示にする」「性的な投稿を非表示にする」）、判定の厳しさ、受付 URL、合言葉。
- ポップアップ: 一時停止スイッチ、今日の理由別の件数（ジャンル外・攻撃的・性的）、直近のエラー。
- 消した投稿の本文は記録しない。件数だけを `chrome.storage.local` に日付つきで持つ。
- 設定は `chrome.storage.sync`（合言葉だけは `local`）。変更は `storage.onChanged` で content script に即時反映し、保持している確率から `decide` をやり直す。

## worker/

### エンドポイント

`POST /classify`

```jsonc
// request  ヘッダー: Authorization: Bearer <合言葉>
{ "questions": { … }, "posts": [ { "id": "1234", "text": "…" } ] }   // posts は最大 20 件
// response
{ "results": { "1234": { "genre": { "tech": 0.87, … }, "offensive": 0.01, "sexual": 0.0 } },
  "errors":  { "5678": "jev_failed" } }
```

Worker は Jev の返り値を上の最小形に詰め直して返す。`decide` は拡張側で走らせる（設定変更を再判定なしで反映するため）。

### 処理順

1. 合言葉を KV の `pass:<合言葉>` で引く。値は `{ name, dailyLimit }`。なければ 401。
2. `questions` を検証する（3 問の形、ジャンル数 ≤ 20、説明文の長さ ≤ 200 字、本文 ≤ 4,000 字）。
3. 投稿ごとに `cacheKey` を計算し、KV の `cache:<key>` を引く。
4. 台帳にない分の件数を、KV の `count:<name>:<YYYY-MM-DD>` に足す。上限を超える分は `errors` に `daily_limit` で返す。全件が上限超過なら 429。
5. 台帳にない分を並列で `env.AI.run('typesafe/jev', …)` に渡す。結果を `cache:<key>` に TTL 30 日で書く。

件数は KV なので数件ずれうる。目的は暴走の防止であり、厳密さは求めない。

### 合言葉の管理

`wrangler kv key put` / `delete` で発行・無効化する。管理画面は作らない。手順は README に書く。

### CORS

拡張の background から呼ぶので CORS ヘッダーは不要。manifest の `host_permissions` に受付 URL を入れる。

## テスト

- `shared/`: `buildQuestions`、`decide`、`cacheKey` の単体テスト（bun test）。`decide` は境界値と評価順を重点的に。
- `worker/`: `env.AI` と KV をスタブにして、認証、検証、台帳ヒット、上限、部分失敗を確かめる。
- `extension/`: `x-dom.ts` を X の DOM を模した固定 HTML で確かめる。表示枠の再利用（同じ要素に別の投稿 ID が入る）を必ず含める。
- 手動確認: 実際の x.com でホーム、検索、個別ページ、一時停止を見る。

## 実装の最初にやること

日本語の投稿 30 件（ジャンル・攻撃的・性的の正解ラベルつき）を Jev に投げ、正解率、確率の分布、1 件あたりの応答時間とトークン数を測る。Jev のページには対応言語、料金、応答時間の記載がない。使いものにならない結果なら、先へ進まず相談する。

## やらないこと

- 画像・動画の判定
- Chrome ウェブストアでの公開
- X への操作（ミュート、ブロック、通報）
- スマホ対応
- 消した投稿の履歴、その場で開き直す機能
- 各自のトークンで Cloudflare を直接呼ぶモード
- X の内部通信の横取りによる先読み（待ち時間が問題になったら再検討）
