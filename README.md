# Study Platform

プログラミングサークル向けの学習プラットフォーム。サークルの Discord サーバーのメンバーだけがログインでき、教材の閲覧とテスト (一問一答) を行えます。

turborepo によるモノレポ構成で、Hono の RPC 機能でサーバーとクライアントの型を共有します。

## 機能

| 機能 | 内容 |
| --- | --- |
| 認証 | Discord OAuth2。指定サーバー (guild) のメンバーのみログイン可。指定ロールを持つ人は **管理者** (教材・テストの作成/編集) |
| コース | 教材とテストをまとめる単位 |
| Markdown 教材 | ブラウザ上で作成・編集 (左右分割プレビュー)。GFM (表・チェックリスト等) とコードのシンタックスハイライト対応。画像はボタン / 貼り付け / ドラッグ&ドロップで R2 にアップロードして挿入 |
| ファイル教材 | PDF / PPTX / DOCX / 画像 / 動画 / テキスト等を R2 にアップロードして閲覧 (下表) |
| テスト | 一問一答。問題文・解説は Markdown。1 問に複数の正解を登録可 |
| 採点 | サーバー側で登録済みの正解と照合。受験中は正解をクライアントに送らない。履歴は本人と管理者が閲覧可 |

### ファイル形式ごとの閲覧方法

| 形式 | 表示方法 | 備考 |
| --- | --- | --- |
| PDF | ブラウザ内蔵 PDF ビューア (iframe) | 最も確実。Range リクエスト対応 |
| PPTX | [pptx-preview](https://www.npmjs.com/package/pptx-preview) でブラウザ内描画 | 簡易描画。アニメーション・SmartArt・一部フォント等は再現されない |
| DOCX | [docx-preview](https://www.npmjs.com/package/docx-preview) でブラウザ内描画 | |
| 画像 / mp4 / webm / mp3 | `<img>` / `<video>` / `<audio>` | |
| md / txt / csv | Markdown 描画 / テキスト表示 | |
| ppt / xlsx / その他 | ダウンロードのみ | |

#### PPTX 閲覧についての検討

| 方式 | 長所 | 短所 |
| --- | --- | --- |
| **ブラウザ内描画 (採用)** | 追加インフラ不要。ファイルが外部に出ない。認証 Cookie のままで動く | 再現度は中程度 |
| Microsoft Office Online Viewer (`view.officeapps.live.com`) | 再現度が高い | ファイルを**公開 URL** で Microsoft に渡す必要がある (メンバー限定にできない / 署名付き URL を発行しても外部送信になる)。localhost では使えない |
| アップロード時に PDF へ変換 | 表示が確実 | Workers 上では LibreOffice が動かないため、Cloudflare Containers 等の別基盤が必要 |

運用としては「**見た目が重要な資料は PDF でエクスポートしてアップロード、PPTX は簡易プレビュー + ダウンロード**」を推奨します。将来 PDF 自動変換が必要になれば、Containers で LibreOffice を動かしアップロード時に PDF を生成して `files` に併置する拡張が可能です。

### 採点ルール

解答と登録済みの正解を次の正規化後に比較し、いずれか 1 つと一致すれば正解です (`apps/server/src/lib/grading.ts`)。

- Unicode NFKC 正規化 (全角英数字・全角記号 → 半角)
- 前後の空白除去、連続する空白を 1 つに
- 「大文字・小文字を区別する」が OFF (既定) なら小文字化して比較

## 技術スタック

- **モノレポ**: turborepo + pnpm workspaces
- **フロントエンド** (`apps/web`): React 19 / React Router (Declarative Mode) / Tailwind CSS v4 / shadcn/ui / TanStack Query / Vite
- **バックエンド** (`apps/server`): Hono / Cloudflare Workers
- **DB**: Cloudflare D1 + Drizzle ORM
- **ストレージ**: Cloudflare R2 (教材ファイル `files/<courseId>/...`, Markdown 画像 `images/...`)
- **型共有**: Hono RPC (`hc<AppType>`) — `apps/server` がエクスポートする `AppType` を `apps/web` から直接 import
- **配信**: `apps/web` のビルド成果物 (`dist/`) を Workers の Static Assets として同一 Worker から配信 (同一オリジン)

## セットアップ

```bash
pnpm install
```

### 1. Discord アプリケーションを作成

1. [Discord Developer Portal](https://discord.com/developers/applications) で New Application
2. **OAuth2** → Redirects に以下を追加
   - 開発: `http://localhost:5173/api/auth/callback` (Vite 経由)、必要なら `http://localhost:8787/api/auth/callback`
   - 本番: `https://<あなたのドメイン>/api/auth/callback`
3. Client ID / Client Secret を控える
4. Discord クライアントで「開発者モード」を ON にし、サークルのサーバー ID と、管理者にしたいロールの ID をコピー

使用スコープは `identify` と `guilds.members.read` (サーバー所属・ロールの確認) です。Bot の追加は不要です。

### 2. D1 / R2 を作成

```bash
cd apps/server
pnpm exec wrangler d1 create study-platform-db
pnpm exec wrangler r2 bucket create study-platform-files
```

出力された `database_id` を `apps/server/wrangler.jsonc` の `d1_databases[0].database_id` に設定してください。

### 3. 環境変数

ローカル: `apps/server/.dev.vars.example` を `.dev.vars` にコピーして値を設定。

| 変数 | 説明 |
| --- | --- |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord アプリの認証情報 |
| `DISCORD_GUILD_ID` | サークルの Discord サーバー ID。ここのメンバーのみログイン可 |
| `DISCORD_ADMIN_ROLE_IDS` | 管理者とみなすロール ID (カンマ区切り)。ログインのたびに同期される |
| `APP_URL` | (任意) OAuth の戻り先の基準 URL。Vite で開発する場合 `http://localhost:5173` |
| `DEV_AUTH_BYPASS` | (開発専用) `true` で localhost 限定の「開発用ログイン」を有効化。**本番では設定しない** |

本番:

```bash
cd apps/server
pnpm exec wrangler secret put DISCORD_CLIENT_ID
pnpm exec wrangler secret put DISCORD_CLIENT_SECRET
pnpm exec wrangler secret put DISCORD_GUILD_ID
```

`DISCORD_ADMIN_ROLE_IDS` は `wrangler.jsonc` の `vars` に記述します。

### 4. マイグレーション

スキーマは `apps/server/src/db/schema.ts` に定義します。編集したら:

```bash
pnpm db:generate          # drizzle-kit で SQL マイグレーションを生成
pnpm db:migrate:local     # ローカルの D1 (wrangler dev) に適用
pnpm db:migrate:remote    # 本番の D1 に適用
```

### 5. 開発サーバーを起動

```bash
pnpm dev
```

- `apps/server`: `http://localhost:8787` (wrangler dev。R2/D1 はローカルエミュレーション)
- `apps/web`: `http://localhost:5173` (Vite dev server, `/api/*` を wrangler dev にプロキシ)

`DEV_AUTH_BYPASS=true` の場合、ログイン画面に「開発用ログイン」が表示され、Discord 設定なしで管理者/メンバーとして動作確認できます。

## データモデル

```
users ─┬─ sessions               (Cookie のトークンは SHA-256 ハッシュで保存)
       │
courses ─┬─ documents            (Markdown 教材)
         ├─ files                (R2 上の教材ファイル)
         └─ question_groups      (テスト)
               └─ questions      (問題・正解 [JSON 配列]・解説)
images                           (Markdown 用画像)
answers (受験記録: user × question_group, score/total)
  └─ each_answers (各問題への解答と正誤)
```

## API 概要

`/api/auth/*` 以外はログイン必須。✏️ は管理者のみ。

| メソッド | パス | |
| --- | --- | --- |
| GET | `/api/auth/login` → `/api/auth/callback` | Discord OAuth |
| GET / POST | `/api/auth/me` / `/api/auth/logout` | |
| GET / POST✏️ | `/api/courses` | |
| GET / PATCH✏️ / DELETE✏️ | `/api/courses/:id` | GET は教材・テスト一覧を含む |
| POST✏️ / GET / PATCH✏️ / DELETE✏️ | `/api/documents[/:id]` | |
| POST✏️ (multipart) / GET / PATCH✏️ / DELETE✏️ | `/api/files[/:id]` | 上限 50MB |
| GET | `/api/files/:id/content[?download=1]` | R2 から配信 (Range 対応) |
| POST✏️ (multipart) / GET | `/api/images[/:id]` | PNG/JPEG/GIF/WebP, 上限 10MB |
| POST✏️ / GET / PATCH✏️ / DELETE✏️ | `/api/quizzes[/:id]` | GET は正解を含まない |
| GET✏️ / PUT✏️ | `/api/quizzes/:id/edit` / `/api/quizzes/:id/questions` | 正解込みの取得 / 問題の一括保存 |
| POST | `/api/quizzes/:id/submit` | 採点して受験記録を保存 |
| GET | `/api/quizzes/:id/attempts[?all=1]` | 受験履歴 (`all=1` は管理者のみ) |
| GET | `/api/attempts/:id` | 採点結果の詳細 (本人 or 管理者) |

## セキュリティ上の考慮

- OAuth `state` を Cookie で検証 (CSRF 対策)、ログイン後のリダイレクト先は同一オリジンの相対パスのみ
- セッション Cookie は `HttpOnly` / `SameSite=Lax` / (HTTPS 時) `Secure`
- Markdown は生 HTML を描画しない (XSS 対策)。画像アップロードは SVG 不可
- アップロードファイルの Content-Type はクライアント申告ではなく拡張子から決定し、`nosniff` を付与。PDF/画像/動画/テキスト以外は `Content-Disposition: attachment` で配信

## ビルド・デプロイ

```bash
pnpm build:only   # web#build → server#build (dry-run) まで。デプロイはしない
pnpm build        # ↑ + wrangler deploy (本番の Worker を更新します)
```

依存関係の詳細は `turbo.json` を参照してください。
