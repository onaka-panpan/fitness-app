# fitness-app

7日間のローテーションサイクルに基づいて自動的にワークアウトメニューを生成する、個人向けフィットネス/トレーニング管理アプリケーション。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)
![Node](https://img.shields.io/badge/node-18-green.svg)
![MySQL](https://img.shields.io/badge/mysql-8.0-blue.svg)

## 特徴

- **自動メニュー生成**: 7日間のローテーションスケジュールに基づいて、毎日のワークアウトメニューを自動生成
- **種目管理**: 重量、RM、セット数、時間などの詳細スペック管理
- **メディアサポート**: 種目に画像やYouTube動画を登録可能
- **履歴追跡**: 過去のワークアウト記録を自動保存
- **レスポンシブUI**: スマホ・タブレット・PCに対応
- **マルチユーザー対応**: Cookie/Session認証によるユーザー管理

## 技術スタック

- **フロントエンド**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **バックエンド**: Node.js 18 + Express 4.18
- **データベース**: MySQL 8.0
- **インフラ**: Docker Compose
- **認証**: express-session + bcrypt
- **ファイル処理**: multer

## クイックスタート（開発環境）

### 前提条件

- Docker Desktop（またはDocker + Docker Compose）
- Git

### インストール

1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/fitness-app.git
cd fitness-app
```

2. 環境変数の設定

```bash
cp .env.example .env
```

3. Dockerコンテナの起動

```bash
docker-compose up -d
```

4. ブラウザでアクセス

```
http://localhost:8080
```

5. デモアカウントでログイン

- ユーザー名: `demo`
- パスワード: `demo123`

### 停止

```bash
docker-compose down
```

## 本番環境へのデプロイ

本番環境（Ubuntu Server）へのデプロイ手順は以下を参照してください:

- **クイックスタート**: [QUICKSTART.md](./QUICKSTART.md) - 最短5ステップでデプロイ
- **詳細ガイド**: [DEPLOYMENT.md](./DEPLOYMENT.md) - 詳細な手順とトラブルシューティング

### デプロイスクリプト

本番環境での運用を簡単にするスクリプトを用意しています:

```bash
# 初回セットアップ
./deploy.sh setup

# アプリケーション起動
./deploy.sh start

# データベースマイグレーション
./deploy.sh migrate

# その他のコマンド
./deploy.sh help
```

## プロジェクト構造

```
fitness-app/
├── api/                    # バックエンド（Node.js + Express）
│   ├── server.js           # メインサーバーファイル
│   ├── package.json        # Node依存関係
│   └── uploads/            # アップロード画像保存
├── web/                    # フロントエンド
│   ├── src/
│   │   ├── index.html      # SPAエントリーポイント
│   │   ├── app.js          # アプリケーションロジック
│   │   └── styles.css      # スタイリング
│   ├── nginx.conf          # 開発用Nginx設定
│   └── nginx.prod.conf     # 本番用Nginx設定（SSL対応）
├── db/                     # データベース
│   └── init/               # 初期化SQLスクリプト
├── docker-compose.yml      # 開発用Docker Compose設定
├── docker-compose.prod.yml # 本番用Docker Compose設定
├── deploy.sh               # デプロイ管理スクリプト
├── .env.example            # 開発用環境変数テンプレート
└── .env.production.example # 本番用環境変数テンプレート
```

## 主要機能

### 1. 本日のメニュー

- 現在のサイクル日に基づいて自動的にメニュー生成
- 必須種目とローテーション種目を組み合わせて表示
- 種目の画像・動画をモーダルで確認可能
- 「完了して記録」でサイクルを進める

### 2. 種目管理

- 種目の登録・編集・削除
- 重量、RM、セット数、時間などの詳細管理
- 画像アップロードまたはYouTube動画の埋め込み
- 部位(1)と部位(2)の2段階分類

### 3. ローテーション設定

- Day 1〜7の7日間サイクルを設定
- 各日に複数の部位を割り当て可能
- 休息日の設定も可能

### 4. 履歴

- 過去のワークアウト記録を日付順に表示
- 実施した種目の一覧を確認可能

## API エンドポイント

### 認証

- `POST /api/auth/signup` - 新規ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報

### アプリケーション（認証必須）

- `GET /api/user` - ユーザー情報とサイクル日
- `PUT /api/user/cycle` - サイクル日の更新
- `GET /api/body-parts` - 部位マスターデータ
- `GET/POST /api/rotations` - ローテーション設定
- `GET/POST/PUT/DELETE /api/exercises` - 種目管理
- `POST /api/upload-image` - 画像アップロード
- `GET /api/today-menu` - 本日のメニュー生成
- `POST /api/workout/complete` - ワークアウト完了記録
- `POST /api/workout/skip` - 日をスキップ
- `GET /api/history` - 履歴取得

## 開発

### ローカル開発環境

```bash
# APIサーバーのみ起動（ホットリロード）
cd api
npm install
npm run dev

# フロントエンドは別のWebサーバーで配信
# または、docker-composeで全体を起動
```

### データベース直接アクセス

```bash
docker exec -it fitness-app-db-1 mysql -uappuser -papppassword myapp
```

### ログ確認

```bash
# 全サービス
docker-compose logs -f

# APIのみ
docker-compose logs -f api
```

## セキュリティ

本番環境では以下のセキュリティ対策が実装されています:

- HTTPS強制（Let's Encrypt SSL証明書）
- セキュアCookieフラグ（`NODE_ENV=production`時に自動有効化）
- bcryptによるパスワードハッシュ化
- プリペアドステートメントによるSQLインジェクション対策
- CORS設定
- セキュリティヘッダー（HSTS, X-Frame-Options, X-Content-Type-Options, etc.）

## ライセンス

MIT License

## ドキュメント

- [CLAUDE.md](./CLAUDE.md) - プロジェクト仕様と要件定義
- [QUICKSTART.md](./QUICKSTART.md) - 本番環境クイックスタート
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 詳細デプロイガイド

## サポート

問題が発生した場合は、[Issues](https://github.com/yourusername/fitness-app/issues) を作成してください。
