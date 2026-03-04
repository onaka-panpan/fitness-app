-- 文字コード設定
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    current_cycle_day INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 部位マスタ
CREATE TABLE IF NOT EXISTS body_parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ローテーション設定
CREATE TABLE IF NOT EXISTS rotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
    body_part_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (body_part_id) REFERENCES body_parts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rotation (user_id, day_number, body_part_id)
);

-- 種目マスタ
CREATE TABLE IF NOT EXISTS exercises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    body_part_id INT NOT NULL,
    part2_name VARCHAR(50),
    frequency_type ENUM('required', 'rotation') NOT NULL DEFAULT 'rotation',
    weight DECIMAL(5,1) DEFAULT 0,
    rm INT,
    sets INT,
    time_minutes INT,
    description TEXT,
    image_url VARCHAR(500),
    last_performed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (body_part_id) REFERENCES body_parts(id) ON DELETE CASCADE
);

-- 実施履歴
CREATE TABLE IF NOT EXISTS workout_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    workout_date DATE NOT NULL,
    cycle_day INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 実施履歴詳細（各種目の記録）
CREATE TABLE IF NOT EXISTS workout_log_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workout_log_id INT NOT NULL,
    exercise_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workout_log_id) REFERENCES workout_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- 部位(2)サジェスト用テーブル
CREATE TABLE IF NOT EXISTS part2_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    body_part_id INT NOT NULL,
    part2_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (body_part_id) REFERENCES body_parts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_suggestion (user_id, body_part_id, part2_name)
);

-- 部位マスタの初期データ挿入
INSERT INTO body_parts (name) VALUES
    ('背中'),
    ('上腕二頭筋'),
    ('腕'),
    ('肩'),
    ('上腕三頭筋'),
    ('下半身'),
    ('胸');

-- デフォルトユーザー作成
INSERT INTO users (current_cycle_day) VALUES (1);

-- サンプルローテーション設定（Day 1: 背中・上腕二頭筋, Day 2: 胸・上腕三頭筋, Day 3: 肩, Day 4: 下半身, Day 5-7: 休息日）
INSERT INTO rotations (user_id, day_number, body_part_id) VALUES
    (1, 1, 1),  -- Day 1: 背中
    (1, 1, 2),  -- Day 1: 上腕二頭筋
    (1, 2, 7),  -- Day 2: 胸
    (1, 2, 5),  -- Day 2: 上腕三頭筋
    (1, 3, 4),  -- Day 3: 肩
    (1, 4, 6);  -- Day 4: 下半身

-- サンプル種目データ
INSERT INTO exercises (user_id, name, body_part_id, part2_name, frequency_type, weight, rm, sets, time_minutes, description) VALUES
    -- 背中
    (1, 'ラットプルダウン', 1, '広背筋', 'required', 50, 10, 3, 5, '広背筋をメインに鍛える基本種目'),
    (1, 'シーテッドロウ', 1, '僧帽筋', 'required', 45, 10, 3, 5, '背中の厚みを出す種目'),
    (1, 'ワンハンドロウ', 1, '広背筋', 'rotation', 20, 12, 3, 5, '片側ずつ行う種目'),
    (1, 'デッドリフト', 1, '脊柱起立筋', 'rotation', 80, 8, 3, 8, '全身を使う複合種目'),

    -- 上腕二頭筋
    (1, 'バーベルカール', 2, NULL, 'required', 25, 10, 3, 4, '上腕二頭筋の基本種目'),
    (1, 'ハンマーカール', 2, '腕橈骨筋', 'rotation', 12, 12, 3, 4, '前腕も鍛えられる'),
    (1, 'インクラインカール', 2, '長頭', 'rotation', 10, 10, 3, 4, 'ストレッチを効かせる種目'),

    -- 胸
    (1, 'ベンチプレス', 7, '大胸筋中部', 'required', 60, 10, 3, 6, '胸の基本種目'),
    (1, 'インクラインベンチ', 7, '大胸筋上部', 'required', 50, 10, 3, 5, '大胸筋上部を鍛える'),
    (1, 'ダンベルフライ', 7, '大胸筋', 'rotation', 14, 12, 3, 4, 'ストレッチ種目'),

    -- 上腕三頭筋
    (1, 'トライセプスプッシュダウン', 5, '外側頭', 'required', 25, 12, 3, 4, '三頭筋の基本種目'),
    (1, 'オーバーヘッドエクステンション', 5, '長頭', 'rotation', 15, 10, 3, 4, '長頭をストレッチ'),

    -- 肩
    (1, 'ショルダープレス', 4, '三角筋前部', 'required', 30, 10, 3, 5, '肩の基本種目'),
    (1, 'サイドレイズ', 4, '三角筋中部', 'required', 8, 15, 3, 4, '肩幅を広げる種目'),
    (1, 'リアレイズ', 4, '三角筋後部', 'rotation', 6, 15, 3, 4, '後部を鍛える種目'),
    (1, 'フロントレイズ', 4, '三角筋前部', 'rotation', 8, 12, 3, 4, '前部を鍛える種目'),

    -- 下半身
    (1, 'スクワット', 6, '大腿四頭筋', 'required', 80, 10, 4, 8, '下半身の王道種目'),
    (1, 'レッグプレス', 6, '大腿四頭筋', 'required', 120, 12, 3, 5, 'マシンで安全に高重量'),
    (1, 'レッグカール', 6, 'ハムストリング', 'rotation', 40, 12, 3, 4, '裏もも'),
    (1, 'カーフレイズ', 6, 'ふくらはぎ', 'rotation', 0, 20, 3, 3, '自重でも可');
