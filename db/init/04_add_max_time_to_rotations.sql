-- ローテーション設定に時間上限を追加
ALTER TABLE rotations ADD COLUMN max_time_minutes INT DEFAULT NULL COMMENT '当日のメニュー合計時間の上限（分）';
