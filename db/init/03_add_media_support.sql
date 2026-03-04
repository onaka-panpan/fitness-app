-- メディアサポート機能追加マイグレーション

-- メディアタイプカラムを追加
ALTER TABLE exercises
ADD COLUMN media_type ENUM('none', 'image', 'youtube') DEFAULT 'none' AFTER image_url;

-- メディアコンテンツカラムを追加（画像ファイル名またはYouTube iframe/URL）
ALTER TABLE exercises
ADD COLUMN media_content TEXT AFTER media_type;

-- 既存のimage_urlデータがある場合は、media_typeとmedia_contentに移行
UPDATE exercises
SET
    media_type = 'image',
    media_content = image_url
WHERE image_url IS NOT NULL AND image_url != '';
