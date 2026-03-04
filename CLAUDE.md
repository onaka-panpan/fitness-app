# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

7日間のローテーションサイクルに基づいて自動的にワークアウトメニューを生成する、個人向けフィットネス/トレーニング管理アプリケーションです。ユーザーは種目ライブラリの管理、日ごとの部位スケジュール設定、完了したワークアウトの記録ができます。

## ドキュメント構成

このプロジェクトは目的別に複数のドキュメントを提供しています：

- **README.md** - プロジェクト全体の概要、主要機能、APIエンドポイント一覧
- **QUICKSTART.md** - 本番環境への最短デプロイ手順（5ステップ）
- **DEPLOYMENT.md** - 詳細なデプロイ手順、トラブルシューティング
- **CLAUDE.md (このファイル)** - 開発者向け技術仕様とアーキテクチャ詳細

## 技術スタック

- **フロントエンド**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **バックエンド**: Node.js 18 + Express 4.18
- **データベース**: MySQL 8.0
- **Webサーバー**: Nginx（リバースプロキシ）
- **インフラ**: Docker Compose
- **認証**: express-session + bcrypt (Cookie/Session方式)
- **ファイルアップロード**: multer (画像アップロード処理)

## 環境変数設定

このプロジェクトでは、環境ごとに変わる可能性のあるパラメータ（データベース認証情報、ポート番号、URLなど）を環境変数で管理しています。

### 初回セットアップ

1. `.env.example`をコピーして`.env`ファイルを作成:
```bash
cp .env.example .env
```

2. `.env`ファイルを編集して、必要に応じて値を変更:
```bash
# 例：本番環境ではセキュアなパスワードに変更
DB_PASSWORD=your_secure_password
SESSION_SECRET=your_random_secret_key
```

### 環境変数一覧

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `NODE_ENV` | `development` | 実行環境（development/production） |
| `WEB_PORT` | `8080` | フロントエンドのポート番号 |
| `FRONTEND_URL` | `http://localhost:8080` | フロントエンドのURL |
| `API_PORT` | `3000` | バックエンドAPIのポート番号 |
| `SESSION_SECRET` | `fitness-app-secret-key-change-in-production` | セッション暗号化キー（**本番環境では必ず変更**） |
| `CORS_ORIGIN` | `http://localhost:8080` | CORS許可オリジン |
| `UPLOAD_MAX_SIZE_MB` | `5` | 画像アップロードの最大サイズ（MB） |
| `DB_HOST` | `db` | データベースホスト |
| `DB_PORT` | `3306` | データベースポート |
| `DB_NAME` | `myapp` | データベース名 |
| `DB_USER` | `appuser` | データベースユーザー名 |
| `DB_PASSWORD` | `apppassword` | データベースパスワード（**本番環境では必ず変更**） |
| `MYSQL_ROOT_PASSWORD` | `rootpassword` | MySQLルートパスワード（**本番環境では必ず変更**） |

**注意**: `.env`ファイルには機密情報が含まれるため、Gitにコミットしないでください（`.gitignore`に追加済み）。

## コマンド

### 開発環境（Docker）

```bash
# 全サービス起動
docker-compose up

# リビルドして起動
docker-compose up --build

# サービス停止
docker-compose down
```

### 本番環境（deploy.shスクリプト）

本番環境では `deploy.sh` スクリプトで運用を簡単化できます：

```bash
# 初回セットアップ（.env作成）
./deploy.sh setup

# アプリケーション起動
./deploy.sh start

# データベースマイグレーション実行
./deploy.sh migrate

# その他のコマンド
./deploy.sh stop       # 停止
./deploy.sh restart    # 再起動
./deploy.sh rebuild    # 再ビルド
./deploy.sh logs       # ログ表示
./deploy.sh backup     # DBバックアップ
./deploy.sh status     # 状態確認
./deploy.sh help       # ヘルプ表示
```

**deploy.shの主要機能:**
- 環境変数ファイル（.env）の自動作成
- 本番用docker-compose.prod.ymlの使用
- データベースマイグレーション実行
- データベースバックアップ（日時付きファイル生成）
- カラー出力によるわかりやすいメッセージ

### SSL証明書セットアップ（本番環境）

```bash
# SSL証明書の自動取得（Let's Encrypt）
sudo ./setup-ssl.sh
```

**setup-ssl.shの機能:**
- DNS設定の自動確認
- Dockerコンテナの自動停止（ポート80解放）
- Let's Encrypt証明書の取得
- 証明書アクセス権限の設定
- 自動更新のcron設定（毎日午前3時）

### アクセス先

**開発環境（デフォルト設定）:**
- **フロントエンド**: http://localhost:8080
- **API**: http://localhost:3000（Nginx経由で /api/* でもアクセス可）
- **データベース**: localhost:3306

**本番環境:**
- **フロントエンド**: https://obasan-offline.net
- **API**: https://obasan-offline.net/api/*（Nginxリバースプロキシ経由）

### デフォルトの認証情報（開発用のみ）

**注意**: これらは開発用のデフォルト値です。本番環境では必ず`.env`ファイルで変更してください。

- データベース名: `myapp`
- ユーザー: `appuser`
- パスワード: `apppassword`
- Rootパスワード: `rootpassword`

### デモアカウント

- ユーザー名: `demo`
- パスワード: `demo123`
- 備考: サンプルデータ（種目、ローテーション）が含まれています

## アーキテクチャ概要

### バックエンド (api/server.js)

async/awaitパターンとMySQLコネクションプーリングを使用したRESTful API。

**主要エンドポイント:**

*認証API:*
- `POST /api/auth/signup` - 新規ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

*アプリケーションAPI（認証必須）:*
- `GET /api/user` - 現在のユーザーとサイクル日
- `PUT /api/user/cycle` - サイクル日の更新
- `GET /api/body-parts` - 部位マスターデータ（認証不要）
- `GET/POST /api/rotations` - 週間ローテーション設定
- `GET/POST/PUT/DELETE /api/exercises` - 種目のCRUD操作（メディア情報含む）
- `POST /api/upload-image` - 種目画像のアップロード
- `GET /api/images/:filename` - アップロード画像の配信
- `GET /api/today-menu` - 本日のメニュー生成（コアアルゴリズム）
- `POST /api/workout/complete` - ワークアウト完了記録
- `POST /api/workout/skip` - 日をスキップ
- `GET /api/history` - 過去のワークアウト履歴

**メニュー生成アルゴリズム:**
- ローテーションに基づき、本日の部位に該当する種目を取得
- 必須種目は常に含まれる
- ローテーション種目の選択:
  - **時間上限が設定されている場合**: 上限時間ギリギリまで種目を選択
    - 必須種目の合計時間を上限から差し引いた残り時間を計算
    - 部位(2)ごとにグループ化してラウンドロビン方式で選択（部位の多様性を確保）
    - `last_performed_at`が古い順に優先（各部位から均等に選択）
  - **時間上限が未設定の場合**: 各部位から1つずつ選択（従来の動作）
- 最終的な種目リストは`body_part_id`（部位(1)）でソートされ、同じ部位の種目が連続して表示される

### フロントエンド (web/src/app.js)

Vanilla JavaScriptによる状態管理を持つシングルページアプリケーション。

**グローバル状態:**
- `currentPage` - 現在のビュー
- `currentUser` - ログイン中のユーザー情報
- `bodyParts` - マスターデータキャッシュ
- `exercises` - ユーザーの種目ライブラリ
- `rotations` - 週間ローテーション設定

**8つのメイン画面:**
1. ログイン - ユーザー認証
2. サインアップ - 新規ユーザー登録
3. ホーム - ナビゲーションハブ
4. 本日のメニュー - 日々のワークアウト表示（メディアサムネイル付き）
   - 種目カードに部位(2)を表示（部位(2)未設定時は部位(1)を表示）
   - 同じ部位(1)の種目が連続して表示される（部位ごとにグループ化）
5. 種目一覧 - ソート可能な種目ライブラリ
   - 「新規登録」ボタンが画面上部に配置
6. 種目詳細 - 種目の作成/編集フォーム（画像/YouTube動画登録可能）
7. ローテーション - 7日間の部位割り当て
8. 履歴 - 過去のワークアウトログ

**メディア機能:**
- 種目に画像またはYouTube動画を登録可能
- 画像: ファイルアップロード（jpg, png, gif, webp対応、最大5MB）
- YouTube: 埋め込みコード（iframeタグ）をペーストで登録
- 本日のメニュー画面で各種目横にサムネイル表示
- サムネイルクリックでモーダル拡大表示・動画再生可能

### データベーススキーマ (db/init/init.sql)

**8テーブル:**
- `users` - ユーザー情報（username, password_hash, display_name, current_cycle_day）
- `sessions` - セッション管理（express-sessionが使用）
- `body_parts` - マスターデータ（7部位: 胸、背中、肩、腕など）
- `rotations` - ユーザーごとの日と部位のマッピング
- `exercises` - ユーザーごとのスペック付き種目ライブラリ（media_type, media_contentでメディア管理）
- `workout_logs` - ユーザーごとのセッション記録
- `workout_log_details` - セッションごとの種目詳細
- `part2_suggestions` - ユーザーごとの詳細部位のオートコンプリートキャッシュ

**exercisesテーブルのメディア関連カラム:**
- `media_type` - メディアタイプ（'none', 'image', 'youtube'）
- `media_content` - メディアコンテンツ（画像ファイル名 or YouTube iframeコード）

## 開発上の注意点

### マルチユーザー対応
- Cookie/Session方式による認証システム実装済み
- 全てのデータはユーザーIDに紐付けられている
- パスワードはbcryptでハッシュ化して保存
- セッションは7日間有効（ログイン状態を維持）

### フロントエンドパターン
- 全UI描画は `app.js` 内のDOM操作で実行
- `api()` ラッパーでfetch呼び出し、JSON処理、認証エラーハンドリング
- `credentials: 'include'` でセッションCookieを含める
- `checkAuth()` でページ読み込み時に認証状態を確認
- 未認証時は自動的にログイン画面へリダイレクト
- `showToast()` でユーザー通知
- ハンバーガーメニューによるナビゲーション（ログアウトボタン含む）

### バックエンドパターン
- dotenvによる環境変数管理（`.env`ファイル）
- コネクションプーリング（最大10接続）
- express-sessionによるセッション管理
- `requireAuth` ミドルウェアで認証チェック
- 複数ステップ操作でのトランザクション（ローテーション保存、ワークアウト完了）
- SQLインジェクション防止のプリペアドステートメント
- 全てのクエリで `user_id = req.session.userId` を使用してデータを分離
- multerによる画像アップロード処理（`api/uploads/`ディレクトリに保存）
- ファイル検証（拡張子・MIMEタイプ・サイズ制限）

### ユーティリティスクリプト

**generate-hash.js (パスワードハッシュ生成):**
```bash
cd api
node generate-hash.js
```
- bcryptでパスワードハッシュを生成
- デフォルトは `demo123` のハッシュ化
- 開発・デバッグ時にデータベースへ直接ユーザーを追加する際に使用
- コード内でパスワードを変更して実行可能

### 本番環境の運用

**定期バックアップ（推奨）:**
```bash
# 手動バックアップ
./deploy.sh backup

# cron設定例（毎日午前2時）
0 2 * * * cd /home/username/fitness-app && ./deploy.sh backup >> /var/log/fitness-backup.log 2>&1
```

**ログ監視:**
```bash
# リアルタイムログ確認
./deploy.sh logs

# 特定のサービスのログ
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f web
docker-compose -f docker-compose.prod.yml logs -f db
```

**アプリケーション更新:**
```bash
# コード更新（git pullまたはrsync）
git pull origin main

# 再ビルド・再起動
./deploy.sh rebuild
```

**トラブルシューティング:**
```bash
# サービス状態確認
./deploy.sh status

# コンテナの完全再起動
./deploy.sh stop
./deploy.sh start

# データベース接続確認
docker exec -it fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}
```

### Dockerサービス構成

**開発環境（docker-compose.yml）:**
- `web` - 静的ファイル配信 + APIプロキシのNginx（HTTP）
- `api` - Node.js Expressサーバー
- `db` - 永続化ボリューム付きMySQL

**本番環境（docker-compose.prod.yml）:**
- `web` - 静的ファイル配信 + APIプロキシのNginx（HTTPS、SSL証明書マウント）
- `api` - Node.js Expressサーバー（環境変数でproduction設定）
- `db` - 永続化ボリューム付きMySQL（ヘルスチェック有効）
- すべてのサービスに `restart: unless-stopped` 設定

**本番環境の主な違い:**
- SSL証明書のマウント（Let's Encrypt）
- HTTPSリダイレクト設定（nginx.prod.conf）
- セキュリティヘッダーの追加（HSTS、X-Frame-Options等）
- セキュアCookie設定（NODE_ENV=production時）
- 自動再起動ポリシー

## ファイル構成

```
fitness-app/
├── README.md                        # プロジェクト概要とクイックスタート
├── QUICKSTART.md                    # 本番環境クイックデプロイガイド（5ステップ）
├── DEPLOYMENT.md                    # 詳細なデプロイ手順とトラブルシューティング
├── CLAUDE.md                        # 開発者向け技術仕様（このファイル）
├── .env.example                     # 開発用環境変数テンプレート
├── .env.production.example          # 本番用環境変数テンプレート
├── .env                             # 環境変数設定ファイル（Gitにコミットしない）
├── .gitignore                       # Git除外設定
├── docker-compose.yml               # 開発用Docker Compose設定
├── docker-compose.prod.yml          # 本番用Docker Compose設定（SSL対応）
├── deploy.sh                        # デプロイ管理スクリプト（本番運用用）
├── setup-ssl.sh                     # SSL証明書自動取得スクリプト
├── api/
│   ├── server.js                    # Express APIサーバー（認証・メディアアップロード含む）
│   ├── package.json                 # Node依存関係（express-session, bcrypt, multer, dotenv追加）
│   ├── generate-hash.js             # パスワードハッシュ生成ユーティリティ
│   ├── uploads/                     # アップロード画像保存ディレクトリ（自動作成）
│   └── Dockerfile
├── web/
│   ├── src/
│   │   ├── index.html               # エントリーポイント
│   │   ├── app.js                   # フロントエンドSPAロジック（認証・メディア機能含む）
│   │   └── styles.css               # スタイリング（認証・メディアモーダルスタイル含む）
│   ├── nginx.conf                   # 開発用Nginx設定（HTTP）
│   └── nginx.prod.conf              # 本番用Nginx設定（HTTPS、セキュリティヘッダー）
└── db/
    └── init/
        ├── init.sql                 # スキーマとシードデータ
        ├── 02_add_auth.sql          # 認証機能追加マイグレーション
        ├── 03_add_media_support.sql # メディア機能追加マイグレーション
        └── 04_add_max_time_to_rotations.sql # ローテーション時間上限マイグレーション
```

### 主要ファイルの説明

**ドキュメント:**
- `README.md` - プロジェクト全体の概要、機能説明、API一覧
- `QUICKSTART.md` - 本番環境への最短デプロイ手順（5ステップ）
- `DEPLOYMENT.md` - 詳細なデプロイ手順、DNS設定、SSL証明書取得、トラブルシューティング
- `CLAUDE.md` - 開発者向け技術仕様、アーキテクチャ詳細

**デプロイスクリプト:**
- `deploy.sh` - 本番環境での運用を簡単化するスクリプト（setup、start、stop、migrate、backup等）
- `setup-ssl.sh` - Let's Encrypt SSL証明書の自動取得と設定

**環境変数:**
- `.env.example` - 開発環境用テンプレート
- `.env.production.example` - 本番環境用テンプレート（セキュアな設定例）

**Docker設定:**
- `docker-compose.yml` - 開発環境用（HTTP）
- `docker-compose.prod.yml` - 本番環境用（HTTPS、SSL証明書マウント、自動再起動）

**Nginx設定:**
- `web/nginx.conf` - 開発環境用（HTTP）
- `web/nginx.prod.conf` - 本番環境用（HTTPS、セキュリティヘッダー、HTTPリダイレクト）

**ユーティリティ:**
- `api/generate-hash.js` - bcryptパスワードハッシュ生成ツール（開発・デバッグ用）

## セットアップ手順

### 開発環境セットアップ

1. 環境変数ファイルを作成:
```bash
cp .env.example .env
```

2. 必要に応じて`.env`ファイルを編集（開発環境ではデフォルトのままでOK）

3. 依存パッケージをインストール:
```bash
cd api && npm install
```

4. Dockerコンテナを起動:
```bash
docker-compose up -d
```

5. データベースマイグレーション適用（初回のみ）:
```bash
# 認証機能マイグレーション
docker exec -i fitness-app-db-1 mysql -uappuser -papppassword myapp < db/init/02_add_auth.sql

# メディア機能マイグレーション
docker exec -i fitness-app-db-1 mysql -uappuser -papppassword myapp < db/init/03_add_media_support.sql

# ローテーション時間上限マイグレーション
docker exec -i fitness-app-db-1 mysql -uappuser -papppassword myapp < db/init/04_add_max_time_to_rotations.sql
```

6. ブラウザで http://localhost:8080 にアクセス

7. 以下のいずれかでログイン:
   - デモアカウント（username: `demo`, password: `demo123`）でログイン
   - 新規アカウントを作成

### 本番環境へのデプロイ

**クイックスタート（推奨）:**

詳細は `QUICKSTART.md` を参照してください。最短5ステップでデプロイできます。

```bash
# 1. DNS設定（ドメイン管理画面で実施）
# 2. サーバーセットアップ（Docker、certbotインストール）
# 3. アプリケーションアップロード（rsyncまたはgit clone）
# 4. SSL証明書取得
sudo ./setup-ssl.sh

# 5. アプリケーションデプロイ
./deploy.sh setup    # .env作成
vim .env             # SESSION_SECRET、DB_PASSWORDを変更
./deploy.sh start    # 起動
./deploy.sh migrate  # マイグレーション実行
```

**本番環境の必須セキュリティ対策:**

1. `.env`ファイルで以下の値を変更（重要！）:
   - `SESSION_SECRET`: `openssl rand -base64 48` で生成
   - `DB_PASSWORD`: `openssl rand -base64 24` で生成
   - `MYSQL_ROOT_PASSWORD`: `openssl rand -base64 24` で生成
   - `NODE_ENV`: `production`に設定
   - `CORS_ORIGIN`: `https://obasan-offline.net`に設定

2. SSL証明書の取得（Let's Encrypt）:
   - `setup-ssl.sh`スクリプトで自動取得
   - 証明書は90日ごとに自動更新（cron設定済み）

3. セキュアCookie設定:
   - `NODE_ENV=production`の場合、自動的に`secure: true`が有効化される（server.js 65行目）

4. その他のセキュリティ設定:
   - HTTPSリダイレクト（nginx.prod.confで設定済み）
   - セキュリティヘッダー（HSTS、X-Frame-Options等）
   - ファイアウォール設定（ポート22, 80, 443のみ許可）

**詳細なデプロイ手順:**

`DEPLOYMENT.md` を参照してください。DNS設定、サーバー構築、トラブルシューティング等を詳しく説明しています。

## メディア機能の使い方

### 種目に画像を追加する場合:
1. 種目一覧 → 種目を選択（または新規登録）
2. メディアセクションで「画像」を選択
3. 画像ファイルをアップロード（jpg, png, gif, webp / 最大5MB）
4. プレビューが表示されたら保存

### 種目にYouTube動画を追加する場合:
1. 種目一覧 → 種目を選択（または新規登録）
2. メディアセクションで「YouTube」を選択
3. YouTube動画の埋め込みコード（iframeタグ全体）をテキストエリアにペースト
4. 保存

### メディアの確認:
- 本日のメニュー画面で各種目の横にサムネイルが表示される
- サムネイルをクリックするとモーダルで拡大表示・動画再生が可能
