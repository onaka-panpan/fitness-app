# fitness-app デプロイガイド

このガイドでは、fitness-appをUbuntuサーバーにデプロイして、ドメイン `hogehoge.net` で公開する手順を説明します。

## 前提条件

- Ubuntu Server 20.04/22.04 LTS
- root権限またはsudo権限を持つユーザー
- ドメイン: hogehoge.net（DNS設定可能）
- サーバーのグローバルIPアドレス

---

## 1. サーバー環境の準備

### 1.1 システムのアップデート

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 必要なパッケージのインストール

```bash
sudo apt install -y git curl vim ufw certbot
```

### 1.3 Dockerのインストール

```bash
# Docker公式リポジトリの追加
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Dockerのインストール
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Dockerの起動と自動起動設定
sudo systemctl start docker
sudo systemctl enable docker

# 現在のユーザーをdockerグループに追加（sudoなしでDocker使用可能）
sudo usermod -aG docker $USER
```

### 1.4 Docker Composeのインストール

```bash
# Docker Compose最新版のインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 実行権限の付与
sudo chmod +x /usr/local/bin/docker-compose

# バージョン確認
docker-compose --version
```

**重要**: dockerグループへの追加後は、一度ログアウト/ログインが必要です。

```bash
exit
# 再度SSH接続
```

---

## 2. DNS設定

ドメインレジストラ（お名前.com、ムームードメインなど）の管理画面で以下のDNSレコードを設定します。

### Aレコードの設定

| ホスト名 | タイプ | 値（サーバーのIPアドレス） | TTL |
|---------|--------|---------------------------|-----|
| @ | A | xxx.xxx.xxx.xxx | 3600 |
| www | A | xxx.xxx.xxx.xxx | 3600 |

**設定例**:
- `hogehoge.net` → サーバーIP
- `www.hogehoge.net` → サーバーIP

**注意**: DNS設定の反映には数分〜48時間かかる場合があります。

### DNS設定の確認

```bash
# DNSが正しく設定されているか確認
nslookup hogehoge.net
dig hogehoge.net
```

---

## 3. ファイアウォールの設定

### 3.1 UFWの設定

```bash
# UFWの有効化
sudo ufw enable

# SSH（ポート22）を許可（接続が切れないように最初に設定）
sudo ufw allow 22/tcp

# HTTP（ポート80）を許可
sudo ufw allow 80/tcp

# HTTPS（ポート443）を許可
sudo ufw allow 443/tcp

# 設定確認
sudo ufw status verbose
```

---

## 4. アプリケーションのデプロイ

### 4.1 アプリケーションのクローン

```bash
# ホームディレクトリまたは適切な場所に移動
cd /home/$USER

# リポジトリをクローン（GitHubなどからの場合）
# git clone https://github.com/yourusername/fitness-app.git

# または、ローカルからrsyncでアップロード
# ローカルマシンで実行:
# rsync -avz --exclude 'node_modules' --exclude '.git' \
#   /path/to/fitness-app username@server_ip:/home/username/
```

### 4.2 本番環境用の環境変数設定

```bash
cd fitness-app

# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
vim .env
```

**必須変更項目（.envファイル）**:

```bash
# アプリケーション設定
NODE_ENV=production

# フロントエンド設定
WEB_PORT=8080
FRONTEND_URL=https://hogehoge.net

# バックエンド設定
API_PORT=3000
SESSION_SECRET=<ランダムな長い文字列に変更>

# CORS設定
CORS_ORIGIN=https://hogehoge.net

# ファイルアップロード設定
UPLOAD_MAX_SIZE_MB=5

# データベース設定（強力なパスワードに変更）
DB_HOST=db
DB_PORT=3306
DB_NAME=fitness_production
DB_USER=fitness_user
DB_PASSWORD=<強力なパスワードに変更>
MYSQL_ROOT_PASSWORD=<強力なパスワードに変更>
```

**セキュアなパスワード生成例**:

```bash
# SESSION_SECRET用（64文字のランダム文字列）
openssl rand -base64 48

# DBパスワード用（32文字のランダム文字列）
openssl rand -base64 24
```

### 4.3 本番用Docker Compose設定の作成

`docker-compose.prod.yml` ファイル（既に作成済み）を使用します。

---

## 5. SSL証明書の取得（Let's Encrypt）

### 5.1 Certbotで証明書取得

**注意**: この手順はDNS設定が反映され、ポート80/443が開放されている必要があります。

```bash
# Nginxコンテナを一時的に停止（ポート80を空ける）
docker-compose -f docker-compose.prod.yml down

# スタンドアロンモードで証明書取得
sudo certbot certonly --standalone -d hogehoge.net -d www.hogehoge.net
```

プロンプトに従って入力:
- メールアドレス: 証明書の期限通知用
- 利用規約に同意: Yes
- メール共有: No（推奨）

証明書の保存場所:
- 証明書: `/etc/letsencrypt/live/hogehoge.net/fullchain.pem`
- 秘密鍵: `/etc/letsencrypt/live/hogehoge.net/privkey.pem`

### 5.2 証明書の自動更新設定

```bash
# crontabを編集
sudo crontab -e

# 以下を追加（毎日午前3時に更新チェック）
0 3 * * * certbot renew --quiet --post-hook "docker-compose -f /home/$USER/fitness-app/docker-compose.prod.yml restart web"
```

---

## 6. Nginxの本番用設定

### 6.1 SSL対応Nginx設定ファイル

`web/nginx.prod.conf` ファイル（既に作成済み）を使用します。

### 6.2 証明書へのアクセス権限設定

```bash
# Nginxコンテナが証明書にアクセスできるように、証明書ディレクトリの読み取り権限を設定
sudo chmod -R 755 /etc/letsencrypt/live/
sudo chmod -R 755 /etc/letsencrypt/archive/
```

---

## 7. アプリケーションの起動

### 7.1 本番環境でコンテナ起動

```bash
cd /home/$USER/fitness-app

# 本番用設定でビルド・起動
docker-compose -f docker-compose.prod.yml up -d --build

# ログ確認
docker-compose -f docker-compose.prod.yml logs -f
```

### 7.2 データベースマイグレーション実行

```bash
# コンテナ名を確認
docker ps

# 認証機能マイグレーション
docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/02_add_auth.sql

# メディア機能マイグレーション
docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/03_add_media_support.sql

# ローテーション時間上限マイグレーション
docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/04_add_max_time_to_rotations.sql
```

または、.envファイルの値を直接指定:

```bash
docker exec -i fitness-app-db-1 mysql -ufitness_user -p'your_password' fitness_production < db/init/02_add_auth.sql
docker exec -i fitness-app-db-1 mysql -ufitness_user -p'your_password' fitness_production < db/init/03_add_media_support.sql
docker exec -i fitness-app-db-1 mysql -ufitness_user -p'your_password' fitness_production < db/init/04_add_max_time_to_rotations.sql
```

---

## 8. 動作確認

### 8.1 HTTPSアクセス確認

ブラウザで以下にアクセス:
- `https://hogehoge.net`
- `https://www.hogehoge.net`

### 8.2 ログ確認

```bash
# 全サービスのログ
docker-compose -f docker-compose.prod.yml logs -f

# APIサービスのログのみ
docker-compose -f docker-compose.prod.yml logs -f api

# Webサービスのログのみ
docker-compose -f docker-compose.prod.yml logs -f web
```

### 8.3 コンテナ状態確認

```bash
docker-compose -f docker-compose.prod.yml ps
```

---

## 9. セキュリティチェックリスト

- [x] SESSION_SECRETを強力なランダム文字列に変更
- [x] データベースパスワードを強力なものに変更
- [x] NODE_ENVをproductionに設定
- [x] HTTPS（SSL）を有効化
- [x] Cookie secure フラグを有効化（server.js 65行目）
- [x] ファイアウォール（UFW）を有効化
- [x] 不要なポートを閉じる
- [x] SSH鍵認証を使用（パスワード認証無効化推奨）

### server.jsのセキュリティ設定確認

`api/server.js` の65行目を以下に変更:

```javascript
cookie: {
  secure: true,  // HTTPSを強制（変更必要）
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24 * 7 // 7日間
}
```

---

## 10. 運用コマンド

### アプリケーション再起動

```bash
cd /home/$USER/fitness-app
docker-compose -f docker-compose.prod.yml restart
```

### アプリケーション停止

```bash
docker-compose -f docker-compose.prod.yml down
```

### アプリケーション更新

```bash
# コードを更新（git pullまたはrsync）
git pull origin main

# 再ビルド・再起動
docker-compose -f docker-compose.prod.yml up -d --build
```

### データベースバックアップ

```bash
# バックアップディレクトリ作成
mkdir -p ~/backups

# バックアップ実行
docker exec fitness-app-db-1 mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > ~/backups/fitness_$(date +%Y%m%d_%H%M%S).sql
```

### データベース復元

```bash
docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < ~/backups/fitness_YYYYMMDD_HHMMSS.sql
```

---

## トラブルシューティング

### 証明書エラー

```bash
# 証明書の状態確認
sudo certbot certificates

# 証明書の手動更新
sudo certbot renew --force-renewal
```

### Dockerコンテナが起動しない

```bash
# ログ確認
docker-compose -f docker-compose.prod.yml logs

# コンテナを完全削除して再作成
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build
```

### ポート確認

```bash
# ポート80/443が使用されているか確認
sudo netstat -tlnp | grep ':80\|:443'
```

---

## サポート

問題が発生した場合は、以下のログを確認してください:

1. Dockerログ: `docker-compose -f docker-compose.prod.yml logs`
2. Nginxアクセスログ: `docker-compose -f docker-compose.prod.yml logs web`
3. APIログ: `docker-compose -f docker-compose.prod.yml logs api`
4. システムログ: `sudo journalctl -xe`
