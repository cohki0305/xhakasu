# xhakasu

X のタイムラインから、見たいジャンル以外の投稿と（オプションで）攻撃的・性的な投稿を非表示にする Chrome 拡張。判定は Cloudflare Workers AI の `typesafe/jev`。

- 設計: `docs/superpowers/specs/2026-09-19-xhakasu-design.md`
- 判定するのは投稿の本文だけ。画像だけの投稿は「未判定」と付けて表示する。
- 拡張は自分の画面から投稿を消すだけで、X への操作（ミュート・ブロック・通報）はしない。

## 使う人向け

1. 受け取った zip を展開する。
2. Chrome で `chrome://extensions` を開き、右上の「デベロッパーモード」をオンにする。
3. 「パッケージ化されていない拡張機能を読み込む」で、展開したフォルダを選ぶ。
4. 拡張のアイコン →「設定を開く」で、受け取った**受付 URL** と**アクセスキー**を入れて保存する。
5. x.com を開く。投稿は一瞬薄くなり、判定が終わると表示されるか消える。

消えすぎていると感じたら、アイコンから今日の件数を確かめ、「一時停止」で全部表示に戻して見比べる。

## 管理者向け

```bash
bun install
bun test                 # 全テスト
bun run build:ext        # extension/dist を作る
bun run deploy:worker    # 中継 Worker をデプロイ
```

配布用 zip: `bun run pack`（`xhakasu.zip` ができる。git 管理外）

デプロイすると `https://xhakasu-relay.<あなたのサブドメイン>.workers.dev` が受付 URL になる。Cloudflare のアカウント ID は `.secrets/cloudflare-account-id.txt`（git 管理外）に 1 行で置き、`worker/wrangler.jsonc` の `kv_namespaces[0].id` は自分のものに書き換える（KV は `bunx wrangler kv namespace create xhakasu` で作る）。発行したアクセスキーは git に入れない（`.secrets/` は管理外）。

アクセスキーの発行（1 人 1 本。`dailyLimit` は 1 日に Jev を呼べる回数）:

```bash
PASS=$(openssl rand -hex 16)
bunx wrangler kv key put "key:$PASS" '{"name":"<相手の名前>","dailyLimit":3000}' --binding KV --remote --config worker/wrangler.jsonc
```

無効化: `bunx wrangler kv key delete "key:<アクセスキー>" --binding KV --remote --config worker/wrangler.jsonc`

今日の利用回数: `bunx wrangler kv key get "count:<名前>:$(date -u +%F)" --binding KV --remote --config worker/wrangler.jsonc`（日付は UTC）

## X の画面が変わって動かなくなったら

X の DOM に依存するコードは `extension/src/x-dom.ts` だけ。セレクタ（`SEL`）を直し、`bun test extension/src/x-dom.test.ts` を通す。
