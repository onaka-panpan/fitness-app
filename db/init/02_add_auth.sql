-- 認証機能追加のマイグレーション

-- usersテーブルに認証情報カラムを追加
ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);

-- セッション管理用テーブル
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_expires (expires_at)
);

-- 既存のデフォルトユーザーにデモ用の認証情報を追加
-- パスワードは 'demo123' (実際の実装ではハッシュ化される)
UPDATE users SET
    username = 'demo',
    display_name = 'デモユーザー',
    password_hash = '$2b$10$placeholder'  -- これは後でバックエンドで更新
WHERE id = 1;
