#!/bin/bash

###############################################################################
# fitness-app デプロイスクリプト
#
# 使い方:
#   ./deploy.sh [command]
#
# コマンド:
#   setup      - 初回セットアップ（環境変数の設定など）
#   start      - アプリケーションの起動
#   stop       - アプリケーションの停止
#   restart    - アプリケーションの再起動
#   rebuild    - アプリケーションの再ビルドと起動
#   logs       - ログの表示
#   backup     - データベースのバックアップ
#   migrate    - データベースマイグレーションの実行
#   status     - サービスの状態確認
###############################################################################

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 本番用docker-composeファイル
COMPOSE_FILE="docker-compose.prod.yml"

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

# .envファイルの存在確認
check_env_file() {
    if [ ! -f .env ]; then
        error_exit ".envファイルが見つかりません。'./deploy.sh setup'を実行してください。"
    fi
}

# Dockerの存在確認
check_docker() {
    if ! command -v docker &> /dev/null; then
        error_exit "Dockerがインストールされていません。"
    fi
    if ! command -v docker-compose &> /dev/null; then
        error_exit "Docker Composeがインストールされていません。"
    fi
}

# 初回セットアップ
setup() {
    echo "=== fitness-app 初回セットアップ ==="

    # .envファイルの作成
    if [ -f .env ]; then
        warning_msg ".envファイルは既に存在します。"
        read -p "上書きしますか？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "セットアップを中止しました。"
            exit 0
        fi
    fi

    # .env.production.exampleをコピー
    if [ -f .env.production.example ]; then
        cp .env.production.example .env
        success_msg ".envファイルを作成しました。"
    else
        cp .env.example .env
        success_msg ".envファイルを作成しました（開発用テンプレートから）。"
    fi

    echo ""
    echo "次のステップ:"
    echo "1. .envファイルを編集して、以下の値を変更してください:"
    echo "   - SESSION_SECRET（ランダムな文字列に変更）"
    echo "   - DB_PASSWORD（強力なパスワードに変更）"
    echo "   - MYSQL_ROOT_PASSWORD（強力なパスワードに変更）"
    echo ""
    echo "パスワード生成コマンド:"
    echo "  openssl rand -base64 48  # SESSION_SECRET用"
    echo "  openssl rand -base64 24  # パスワード用"
    echo ""
    echo "2. SSL証明書を取得してください（DEPLOYMENT.mdを参照）"
    echo "3. ./deploy.sh start でアプリケーションを起動してください"
}

# アプリケーションの起動
start() {
    check_docker
    check_env_file

    echo "=== アプリケーションを起動しています... ==="
    docker-compose -f $COMPOSE_FILE up -d --build
    success_msg "アプリケーションが起動しました。"
    echo ""
    docker-compose -f $COMPOSE_FILE ps
}

# アプリケーションの停止
stop() {
    check_docker

    echo "=== アプリケーションを停止しています... ==="
    docker-compose -f $COMPOSE_FILE down
    success_msg "アプリケーションが停止しました。"
}

# アプリケーションの再起動
restart() {
    check_docker
    check_env_file

    echo "=== アプリケーションを再起動しています... ==="
    docker-compose -f $COMPOSE_FILE restart
    success_msg "アプリケーションが再起動しました。"
    echo ""
    docker-compose -f $COMPOSE_FILE ps
}

# アプリケーションの再ビルド
rebuild() {
    check_docker
    check_env_file

    echo "=== アプリケーションを再ビルドしています... ==="
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE up -d --build
    success_msg "アプリケーションが再ビルドされました。"
    echo ""
    docker-compose -f $COMPOSE_FILE ps
}

# ログの表示
logs() {
    check_docker

    echo "=== ログを表示しています（Ctrl+C で終了）... ==="
    docker-compose -f $COMPOSE_FILE logs -f
}

# データベースバックアップ
backup() {
    check_docker
    check_env_file

    # .envから環境変数を読み込む
    source .env

    # バックアップディレクトリの作成
    BACKUP_DIR="backups"
    mkdir -p $BACKUP_DIR

    # バックアップファイル名（日時付き）
    BACKUP_FILE="$BACKUP_DIR/fitness_$(date +%Y%m%d_%H%M%S).sql"

    echo "=== データベースをバックアップしています... ==="
    docker exec fitness-app-db-1 mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > $BACKUP_FILE

    success_msg "バックアップが完了しました: $BACKUP_FILE"
}

# データベースマイグレーション
migrate() {
    check_docker
    check_env_file

    # .envから環境変数を読み込む
    source .env

    echo "=== データベースマイグレーションを実行しています... ==="

    # コンテナが起動しているか確認
    if ! docker ps | grep -q fitness-app-db-1; then
        error_exit "データベースコンテナが起動していません。先に './deploy.sh start' を実行してください。"
    fi

    # 各マイグレーションファイルを実行
    echo "認証機能マイグレーション..."
    docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/02_add_auth.sql || true

    echo "メディア機能マイグレーション..."
    docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/03_add_media_support.sql || true

    echo "ローテーション時間上限マイグレーション..."
    docker exec -i fitness-app-db-1 mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/init/04_add_max_time_to_rotations.sql || true

    success_msg "マイグレーションが完了しました。"
}

# サービスの状態確認
status() {
    check_docker

    echo "=== サービスの状態 ==="
    docker-compose -f $COMPOSE_FILE ps
}

# ヘルプメッセージ
show_help() {
    echo "fitness-app デプロイスクリプト"
    echo ""
    echo "使い方: ./deploy.sh [command]"
    echo ""
    echo "コマンド:"
    echo "  setup      - 初回セットアップ（環境変数の設定など）"
    echo "  start      - アプリケーションの起動"
    echo "  stop       - アプリケーションの停止"
    echo "  restart    - アプリケーションの再起動"
    echo "  rebuild    - アプリケーションの再ビルドと起動"
    echo "  logs       - ログの表示"
    echo "  backup     - データベースのバックアップ"
    echo "  migrate    - データベースマイグレーションの実行"
    echo "  status     - サービスの状態確認"
    echo "  help       - このヘルプを表示"
}

# メイン処理
main() {
    case "${1:-}" in
        setup)
            setup
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        rebuild)
            rebuild
            ;;
        logs)
            logs
            ;;
        backup)
            backup
            ;;
        migrate)
            migrate
            ;;
        status)
            status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo "エラー: 不明なコマンド '${1:-}'"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"
