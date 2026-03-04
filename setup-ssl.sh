#!/bin/bash

###############################################################################
# SSL証明書セットアップスクリプト（Let's Encrypt）
#
# 使い方:
#   sudo ./setup-ssl.sh
#
# 注意:
#   - このスクリプトは初回のSSL証明書取得用です
#   - DNS設定が完了し、ドメインがサーバーを指していることを確認してください
#   - ポート80/443が開放されていることを確認してください
###############################################################################

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ドメイン設定
DOMAIN="obasan-offline.net"
WWW_DOMAIN="www.obasan-offline.net"

# エラーハンドリング
error_exit() {
    echo -e "${RED}エラー: $1${NC}" >&2
    exit 1
}

# 成功メッセージ
success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 警告メッセージ
warning_msg() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 情報メッセージ
info_msg() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# rootチェック
if [ "$EUID" -ne 0 ]; then
    error_exit "このスクリプトはroot権限で実行する必要があります。'sudo ./setup-ssl.sh' を使用してください。"
fi

echo "=== SSL証明書セットアップ（Let's Encrypt） ==="
echo ""

# Certbotの確認
if ! command -v certbot &> /dev/null; then
    warning_msg "Certbotがインストールされていません。インストールしますか？"
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info_msg "Certbotをインストールしています..."
        apt update
        apt install -y certbot
        success_msg "Certbotがインストールされました"
    else
        error_exit "Certbotが必要です"
    fi
fi

# DNS設定の確認
echo ""
info_msg "DNS設定を確認しています..."
echo ""

# nslookupでドメインの解決を確認
DOMAIN_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | grep "Address:" | awk '{print $2}' | tail -1)
SERVER_IP=$(curl -s ifconfig.me)

echo "ドメイン ${DOMAIN} のIP: ${DOMAIN_IP}"
echo "このサーバーのIP: ${SERVER_IP}"
echo ""

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    warning_msg "DNSが正しく設定されていない可能性があります"
    echo "DNS設定を確認してください:"
    echo "  ${DOMAIN} → ${SERVER_IP}"
    echo "  ${WWW_DOMAIN} → ${SERVER_IP}"
    echo ""
    read -p "それでも続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    success_msg "DNS設定が正しく構成されています"
fi

# Dockerコンテナの停止確認
echo ""
info_msg "ポート80を使用しているプロセスを確認しています..."
if netstat -tlnp | grep -q ':80 '; then
    warning_msg "ポート80が使用されています"
    echo ""
    netstat -tlnp | grep ':80 '
    echo ""
    warning_msg "Dockerコンテナを停止する必要があります"
    read -p "Dockerコンテナを停止しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f docker-compose.prod.yml ]; then
            docker-compose -f docker-compose.prod.yml down
            success_msg "Dockerコンテナを停止しました"
        elif [ -f docker-compose.yml ]; then
            docker-compose down
            success_msg "Dockerコンテナを停止しました"
        else
            warning_msg "docker-compose.ymlが見つかりません。手動で停止してください。"
            exit 1
        fi
    else
        error_exit "ポート80を解放してから再実行してください"
    fi
fi

# 証明書取得
echo ""
info_msg "SSL証明書を取得しています..."
echo ""

# メールアドレスの入力
read -p "通知用メールアドレスを入力してください: " EMAIL

if [ -z "$EMAIL" ]; then
    error_exit "メールアドレスが必要です"
fi

# Certbot実行
certbot certonly --standalone \
    -d $DOMAIN \
    -d $WWW_DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    success_msg "SSL証明書の取得に成功しました"
    echo ""
    info_msg "証明書の場所:"
    echo "  証明書: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
    echo "  秘密鍵: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
else
    error_exit "SSL証明書の取得に失敗しました"
fi

# 証明書へのアクセス権限設定
echo ""
info_msg "証明書へのアクセス権限を設定しています..."
chmod -R 755 /etc/letsencrypt/live/
chmod -R 755 /etc/letsencrypt/archive/
success_msg "アクセス権限を設定しました"

# SSL設定ファイルの確認
echo ""
info_msg "SSL推奨設定ファイルを確認しています..."
if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
    warning_msg "options-ssl-nginx.conf が見つかりません。ダウンロードしますか？"
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > /etc/letsencrypt/options-ssl-nginx.conf
        success_msg "options-ssl-nginx.conf をダウンロードしました"
    fi
fi

if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
    warning_msg "ssl-dhparams.pem が見つかりません。ダウンロードしますか？"
    read -p "続行しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > /etc/letsencrypt/ssl-dhparams.pem
        success_msg "ssl-dhparams.pem をダウンロードしました"
    fi
fi

# 自動更新設定
echo ""
info_msg "証明書の自動更新を設定しています..."
CRON_CMD="0 3 * * * certbot renew --quiet --post-hook \"docker-compose -f $(pwd)/docker-compose.prod.yml restart web\" >> /var/log/letsencrypt-renew.log 2>&1"

# 既存のcronエントリをチェック
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    warning_msg "証明書の自動更新は既に設定されています"
else
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    success_msg "証明書の自動更新を設定しました（毎日午前3時）"
fi

# 完了メッセージ
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL証明書のセットアップが完了しました${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "次のステップ:"
echo "1. Dockerコンテナを起動してください:"
echo "   cd $(pwd)"
echo "   ./deploy.sh start"
echo ""
echo "2. ブラウザでアクセスしてください:"
echo "   https://${DOMAIN}"
echo "   https://${WWW_DOMAIN}"
echo ""
info_msg "証明書は90日ごとに自動更新されます"
