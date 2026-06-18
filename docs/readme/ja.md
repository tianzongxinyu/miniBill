[English](en.md) · [简体中文](../../README.md) · [日本語](ja.md)

# 軽帳簿（MiniBill）

軽量・セルフホスト・マルチユーザー対応の個人家計簿 Web アプリ。

## 機能

- **セルフホスト・マルチユーザー**：データはローカル SQLite に保存、ユーザーごとに独立した帳簿；Docker デプロイと飛牛 NAS（fnOS）インストールパッケージに対応
- **収支明細**：収入/支出を記録、タグ・連絡先・メモ・日付に対応；月別閲覧、カーソルページネーションとキーワード検索
- **月次残高**：毎月の実際の口座残高を登録し、明細合計と照合
- **日常支出**：逐筆記帳していない日常の出費を月単位で見積もり、総支出に自動計上
- **連絡先**：任意の明細に紐づけ、詳細ページで往来金額を集計
- **統計分析**：月/年単位のグラフ、タグ・連絡先・メモでフィルタ；全画面表示とデータテーブルに対応
- **データ移行**：帳簿の CSV エクスポート/インポートでバックアップと移行が容易
- **多言語**：多言語 UI（20 言語、完全翻訳）
- **パーソナライズ**：収支の配色（赤上緑下 / 緑上赤下）を切り替え可能
- **モバイル対応**：レスポンシブレイアウト、下部ナビ、プルリフレッシュ、PWA としてインストール可能

## スクリーンショット

### ホーム · 月次帳簿

<img src="../screenshots/home.png" alt="ホーム月次帳簿" width="50%" />

### 明細 · 月別閲覧と検索

<img src="../screenshots/transactions.png" alt="明細一覧" width="50%" />

### 統計 · グラフと明細

<img src="../screenshots/stats.png" alt="統計分析" width="50%" />

### 統計 · 全画面横表示

<img src="../screenshots/stats-fullscreen.png" alt="統計全画面"  />

### マイページ · タグ / データ / バックアップ

<img src="../screenshots/profile.png" alt="マイページ" width="50%" />

## クイックスタート

```bash
cp .env.example .env
docker compose up -d --build
```

[http://localhost:8080](http://localhost:8080) を開き、アカウントを登録して利用開始。

## ローカル開発

**バックエンド：**

```bash
export DATA_DIR=./data
export GOPROXY=https://goproxy.cn,direct
go mod download    # 依存関係を先に取得（一度成功すれば十分）
go run ./cmd/server

# またはスクリプトを使用（GOPROXY 組み込み済み）：
# ./scripts/dev-backend.sh
```

Go プロキシを恒久的に設定することも可能（マシンごとに一度）：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

**フロントエンド：**

```bash
cd web && npm install && npm run dev
```

フロントエンド dev server は `/api` を `:8080` にプロキシします。

## 飛牛 NAS（fnOS）パッケージング

軽帳簿は fnOS ネイティブの `.fpk` インストールパッケージとしてパッケージ化でき、Docker なしで飛牛 NAS 上で直接プロセスを実行できます。

### ビルド要件

- Go 1.22+（クロスコンパイル `linux/amd64` または `linux/arm64`）
- Node.js + npm（`web/out` が存在しない場合、スクリプトが自動で `npm run build` を実行）
- `curl`（初回ビルド時に公式 `fnpack` を `.fnos-shared/` に自動ダウンロード）

### インストールパッケージの構築

プロジェクトルートで実行：

```bash
# x86 NAS（デフォルト）
./scripts/build-fpk.sh 1.0.3

# ARM NAS
./scripts/build-fpk.sh 1.0.3 arm

# x86 と ARM を同時構築
./scripts/build-fpk.sh 1.0.3 all
```

成果物は `dist/minibill_<version>_<platform>.fpk` に出力されます。

スクリプトの処理順：Linux バックエンドバイナリをコンパイル → フロントエンド静的資産と DB マイグレーションをコピー → `fnpack` でパッケージング。

### インストールと設定

1. fnOS にログイン → **アプリセンター** → **手動インストール**
2. NAS アーキテクチャに合った `.fpk` ファイルをアップロード
3. インストールウィザードで **サービスポート**（デフォルト `18080`）と登録の開放可否を設定
4. データディレクトリはデータディスクを選択（システムディスクは不可）
5. インストール後、デスクトップアイコンまたは `http://<NAS-IP>:<ポート>` からアクセス（初回起動時に JWT キーを自動生成）

ポート / 登録スイッチ / バックアップディレクトリの変更：アプリセンター → 軽帳簿 → **アプリ設定** → **実行設定** → **編集** → 保存（保存後にアプリが自動再起動）。

**バックアップディレクトリ：** アプリセンター → 軽帳簿 → **アプリ設定** → **実行設定** → **編集**、絶対パスを入力（例 `/vol1/1000/backups`）；空欄の場合はバックアップ無効。保存後にアプリが自動再起動し、Web の **マイページ → バックアップ管理** で定期バックアップを設定。

アンインストール時、帳簿データ（アプリデータディレクトリの `system.db` と各ユーザーの `ledger.db`）を残すことも可能。

詳細は [デプロイガイド](../deploy.md) を参照。

## ドキュメント

- [API](../api.md)
- [デプロイ](../deploy.md)

## 技術スタック

Go + Gin + SQLite | Next.js + Tailwind + Recharts | Docker
