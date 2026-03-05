# fitness-app クイックスタートガイド

このガイドでは、fitness-appを `hogehoge.net` で公開するための最短手順を説明します。

詳細な説明は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

---

## 📋 前提条件チェックリスト

- [ ] Ubuntu Server 20.04/22.04 LTS がセットアップ済み
- [ ] サーバーのグローバルIPアドレスを確認済み
- [ ] ドメイン `hogehoge.net` の管理権限がある
- [ ] SSH接続でサーバーにアクセス可能

---

## 🚀 デプロイ手順（5ステップ）

### ステップ 1: DNS設定

ドメイン管理画面で以下を設定:

| ホスト名 | タイプ | 値 |
|---------|--------|-----|
| @ | A | サーバーのIPアドレス |
| www | A | サーバーのIPアドレス |

**確認**: `nslookup hogehoge.net` でIPが表示されればOK

---

### ステップ 2: サーバーセットアップ（初回のみ）

サーバーにSSH接続して以下を実行:

```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必要なパッケージのインストール
sudo apt install -y git curl vim ufw certbot

# Dockerのインストール
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 一度ログアウト/ログインして設定を反映
exit
```

再度SSH接続してから続行:

```bash
# ファイアウォール設定
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### ステップ 3: アプリケーションのアップロード

**ローカルマシンで実行**:

```bash
# fitness-appディレクトリに移動
cd /path/to/fitness-app

# サーバーにアップロード（usernameとserver_ipを変更）
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ username@server_ip:/home/username/fitness-app/
```

---

### ステップ 4: SSL証明書の取得

**サーバーで実行**:

```bash
cd /home/$USER/fitness-app

# スタンドアロンモードで証明書取得
sudo certbot certonly --standalone \
  -d hogehoge.net \
  -d www.hogehoge.net
```

メールアドレスを入力し、利用規約に同意。

---

### ステップ 5: アプリケーションのデプロイ

**サーバーで実行**:

```bash
cd /home/$USER/fitness-app

# 初回セットアップ（.envファイル作成）
./deploy.sh setup

# .envファイルを編集（重要！）
vim .env
```

**必ず変更すべき項目**:

```bash
# 以下のコマンドで強力なパスワードを生成
openssl rand -base64 48  # SESSION_SECRET用
openssl rand -base64 24  # パスワード用
```

`.env` ファイルで変更:
- `SESSION_SECRET=生成した文字列`
- `DB_PASSWORD=生成した文字列`
- `MYSQL_ROOT_PASSWORD=生成した文字列`

```bash
# アプリケーション起動
./deploy.sh start

# データベースマイグレーション実行
./deploy.sh migrate

# 動作確認
./deploy.sh status
```

---

## ✅ 動作確認

ブラウザで以下にアクセス:
- https://hogehoge.net
- https://www.hogehoge.net

ログイン画面が表示されればデプロイ成功！

デモアカウント:
- ユーザー名: `demo`
- パスワード: `demo123`

---

## 🛠️ よく使うコマンド

```bash
cd /home/$USER/fitness-app

# ログ確認
./deploy.sh logs

# アプリケーション再起動
./deploy.sh restart

# アプリケーション停止
./deploy.sh stop

# データベースバックアップ
./deploy.sh backup

# サービス状態確認
./deploy.sh status
```

---

## 🔒 セキュリティチェックリスト

- [x] SESSION_SECRETを変更済み
- [x] データベースパスワードを変更済み
- [x] HTTPSを有効化済み
- [x] ファイアウォールを有効化済み
- [ ] SSH鍵認証を設定（推奨）
- [ ] 定期的なバックアップ設定（cron）

---

## 📞 トラブルシューティング

### エラー: 証明書が取得できない

```bash
# ポート80が使用されているか確認
sudo netstat -tlnp | grep :80

# 使用されている場合、Dockerを停止
./deploy.sh stop

# 再度証明書取得を試行
sudo certbot certonly --standalone -d hogehoge.net -d www.hogehoge.net
```

### エラー: アプリケーションにアクセスできない

```bash
# サービス状態確認
./deploy.sh status

# ログ確認
./deploy.sh logs

# ファイアウォール確認
sudo ufw status verbose
```

### DNS設定が反映されない

DNS設定の反映には最大48時間かかる場合があります。以下で確認:

```bash
nslookup hogehoge.net
dig hogehoge.net
```

---

## 📚 詳細ドキュメント

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 詳細なデプロイ手順
- [CLAUDE.md](./CLAUDE.md) - アプリケーション仕様
- [README.md](./README.md) - 開発ガイド

---

## 🎯 次のステップ

1. 新規ユーザーアカウントを作成
2. デモアカウントを削除または無効化（本番環境では推奨）
3. 定期バックアップのcron設定
4. モニタリング・ログ監視の設定
