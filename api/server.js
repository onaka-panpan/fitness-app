require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// アップロード用ディレクトリの作成
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer設定（画像アップロード）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('画像ファイルのみアップロード可能です（jpg, png, gif, webp）'));
  }
};

const uploadMaxSizeMB = parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 5;
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadMaxSizeMB * 1024 * 1024 }
});

// リバースプロキシ（Nginx）を信頼
app.set('trust proxy', 1);

// CORS設定（認証情報を含むリクエストを許可）
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));

app.use(express.json());

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET || 'fitness-app-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 本番環境ではHTTPSを強制
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7日間
    sameSite: 'lax' // CSRF保護とセッション維持のバランス
  }
}));

// DB接続設定
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'myapp',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  waitForConnections: true,
  connectionLimit: 10
};

let pool;

async function initDB() {
  pool = mysql.createPool(dbConfig);
  console.log('Database connected');
}

// ==================== 認証ミドルウェア ====================
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized', requiresAuth: true });
  }
  next();
}

// ==================== 認証API ====================
// サインアップ
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }

    // ユーザー名の重複チェック
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'このユーザー名は既に使用されています' });
    }

    // パスワードをハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // ユーザーを作成
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, current_cycle_day) VALUES (?, ?, ?, 1)',
      [username, passwordHash, displayName || username]
    );

    const userId = result.insertId;

    // セッションに保存
    req.session.userId = userId;
    req.session.username = username;

    res.json({
      success: true,
      user: {
        id: userId,
        username,
        displayName: displayName || username
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ログイン
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
    }

    // ユーザーを検索
    const [users] = await pool.query(
      'SELECT id, username, password_hash, display_name FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }

    const user = users[0];

    // パスワードを検証
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
    }

    // セッションに保存
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ログアウト
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'ログアウトに失敗しました' });
    }
    res.json({ success: true });
  });
});

// 現在のユーザー情報を取得
app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated', requiresAuth: true });
    }

    const [users] = await pool.query(
      'SELECT id, username, display_name, current_cycle_day FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found', requiresAuth: true });
    }

    res.json({
      user: {
        id: users[0].id,
        username: users[0].username,
        displayName: users[0].display_name,
        currentCycleDay: users[0].current_cycle_day
      }
    });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ユーザー ====================
// ユーザー情報取得
app.get('/api/user', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// サイクル日更新
app.put('/api/user/cycle', requireAuth, async (req, res) => {
  try {
    const { cycle_day } = req.body;
    await pool.query('UPDATE users SET current_cycle_day = ? WHERE id = ?', [cycle_day, req.session.userId]);
    res.json({ success: true, cycle_day });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 部位マスタ ====================
app.get('/api/body-parts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM body_parts ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ローテーション ====================
// ローテーション一覧取得
app.get('/api/rotations', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, bp.name as body_part_name
      FROM rotations r
      JOIN body_parts bp ON r.body_part_id = bp.id
      WHERE r.user_id = ?
      ORDER BY r.day_number, r.id
    `, [req.session.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 各日の時間上限取得
app.get('/api/rotation-time-limits', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT day_number, MAX(max_time_minutes) as max_time_minutes
      FROM rotations
      WHERE user_id = ?
      GROUP BY day_number
    `, [req.session.userId]);
    const timeLimits = {};
    rows.forEach(r => {
      timeLimits[r.day_number] = r.max_time_minutes;
    });
    res.json(timeLimits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ローテーション保存（全置換）
app.post('/api/rotations', requireAuth, async (req, res) => {
  const { rotations } = req.body; // [{ day_number, body_part_ids: [], max_time_minutes: number }]
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 既存のローテーションを削除
    await conn.query('DELETE FROM rotations WHERE user_id = ?', [req.session.userId]);

    // 新しいローテーションを挿入
    for (const day of rotations) {
      const maxTime = day.max_time_minutes || null;
      if (day.body_part_ids.length > 0) {
        // 部位が設定されている場合のみ保存
        for (const bodyPartId of day.body_part_ids) {
          await conn.query(
            'INSERT INTO rotations (user_id, day_number, body_part_id, max_time_minutes) VALUES (?, ?, ?, ?)',
            [req.session.userId, day.day_number, bodyPartId, maxTime]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 画像アップロード ====================
// 画像アップロード
app.post('/api/upload-image', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '画像ファイルが選択されていません' });
    }
    res.json({
      success: true,
      filename: req.file.filename,
      url: `/api/images/${req.file.filename}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 画像配信
app.get('/api/images/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadDir, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: '画像が見つかりません' });
  }

  res.sendFile(filepath);
});

// ==================== 種目 ====================
// 種目一覧取得
app.get('/api/exercises', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, bp.name as body_part_name
      FROM exercises e
      JOIN body_parts bp ON e.body_part_id = bp.id
      WHERE e.user_id = ?
      ORDER BY e.body_part_id, e.frequency_type DESC, e.name
    `, [req.session.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 種目詳細取得
app.get('/api/exercises/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, bp.name as body_part_name
      FROM exercises e
      JOIN body_parts bp ON e.body_part_id = bp.id
      WHERE e.id = ? AND e.user_id = ?
    `, [req.params.id, req.session.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 種目作成
app.post('/api/exercises', requireAuth, async (req, res) => {
  try {
    const { name, body_part_id, part2_name, frequency_type, weight, rm, sets, time_minutes, description, image_url, media_type, media_content } = req.body;
    const [result] = await pool.query(`
      INSERT INTO exercises (user_id, name, body_part_id, part2_name, frequency_type, weight, rm, sets, time_minutes, description, image_url, media_type, media_content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.session.userId, name, body_part_id, part2_name || null, frequency_type, weight || 0, rm, sets, time_minutes, description, image_url, media_type || 'none', media_content || null]);

    // part2_nameをサジェストに追加
    if (part2_name) {
      await pool.query(`
        INSERT IGNORE INTO part2_suggestions (user_id, body_part_id, part2_name) VALUES (?, ?, ?)
      `, [req.session.userId, body_part_id, part2_name]);
    }

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 種目更新
app.put('/api/exercises/:id', requireAuth, async (req, res) => {
  try {
    const { name, body_part_id, part2_name, frequency_type, weight, rm, sets, time_minutes, description, image_url, media_type, media_content } = req.body;
    await pool.query(`
      UPDATE exercises SET
        name = ?, body_part_id = ?, part2_name = ?, frequency_type = ?,
        weight = ?, rm = ?, sets = ?, time_minutes = ?, description = ?, image_url = ?, media_type = ?, media_content = ?
      WHERE id = ? AND user_id = ?
    `, [name, body_part_id, part2_name || null, frequency_type, weight || 0, rm, sets, time_minutes, description, image_url, media_type || 'none', media_content || null, req.params.id, req.session.userId]);

    // part2_nameをサジェストに追加
    if (part2_name) {
      await pool.query(`
        INSERT IGNORE INTO part2_suggestions (user_id, body_part_id, part2_name) VALUES (?, ?, ?)
      `, [req.session.userId, body_part_id, part2_name]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 種目削除
app.delete('/api/exercises/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM exercises WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// part2サジェスト取得
app.get('/api/part2-suggestions/:bodyPartId', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT part2_name FROM part2_suggestions WHERE user_id = ? AND body_part_id = ? ORDER BY part2_name',
      [req.session.userId, req.params.bodyPartId]
    );
    res.json(rows.map(r => r.part2_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 本日のメニュー ====================
app.get('/api/today-menu', requireAuth, async (req, res) => {
  try {
    // ユーザーの現在のサイクル日を取得
    const [userRows] = await pool.query('SELECT current_cycle_day FROM users WHERE id = ?', [req.session.userId]);
    const currentDay = userRows[0].current_cycle_day;

    // その日の部位と時間上限を取得
    const [rotationRows] = await pool.query(`
      SELECT r.body_part_id, bp.name as body_part_name, r.max_time_minutes
      FROM rotations r
      LEFT JOIN body_parts bp ON r.body_part_id = bp.id
      WHERE r.user_id = ? AND r.day_number = ?
    `, [req.session.userId, currentDay]);

    // 時間上限の取得（同じ日なら全て同じ値）
    const maxTimeMinutes = rotationRows.length > 0 ? rotationRows[0].max_time_minutes : null;

    // body_part_idがNULLでない行のみフィルタ
    const validRotations = rotationRows.filter(r => r.body_part_id !== null);

    if (validRotations.length === 0) {
      return res.json({
        cycle_day: currentDay,
        is_rest_day: true,
        body_parts: [],
        exercises: [],
        total_time: 0,
        max_time_minutes: maxTimeMinutes
      });
    }

    const bodyPartIds = validRotations.map(r => r.body_part_id);
    const bodyPartNames = validRotations.map(r => r.body_part_name);

    // 必須種目を取得
    const [requiredExercises] = await pool.query(`
      SELECT e.*, bp.name as body_part_name
      FROM exercises e
      JOIN body_parts bp ON e.body_part_id = bp.id
      WHERE e.user_id = ? AND e.body_part_id IN (?) AND e.frequency_type = 'required'
      ORDER BY e.body_part_id, e.name
    `, [req.session.userId, bodyPartIds]);

    // 必須種目の合計時間を計算
    const requiredTotalTime = requiredExercises.reduce((sum, e) => sum + (e.time_minutes || 0), 0);

    // ローテーション種目を取得（上限時間ギリギリまで、部位(2)の多様性を確保）
    const rotationExercises = [];

    if (maxTimeMinutes && maxTimeMinutes > 0) {
      // 時間上限が設定されている場合
      let remainingTime = maxTimeMinutes - requiredTotalTime;

      if (remainingTime > 0) {
        // 対象部位のローテーション種目を全て取得（last_performed_atが古い順）
        const [allRotationExercises] = await pool.query(`
          SELECT e.*, bp.name as body_part_name
          FROM exercises e
          JOIN body_parts bp ON e.body_part_id = bp.id
          WHERE e.user_id = ? AND e.body_part_id IN (?) AND e.frequency_type = 'rotation'
          ORDER BY e.last_performed_at IS NULL DESC, e.last_performed_at ASC, e.id ASC
        `, [req.session.userId, bodyPartIds]);

        // 部位(2)の多様性を確保しながら選択
        const selectedExercises = [];
        const usedPart2Count = new Map(); // 各part2が何回選ばれたかカウント

        // part2_nameごとにグループ化
        const exercisesByPart2 = new Map();
        for (const exercise of allRotationExercises) {
          const part2Key = `${exercise.body_part_id}_${exercise.part2_name || 'null'}`;
          if (!exercisesByPart2.has(part2Key)) {
            exercisesByPart2.set(part2Key, []);
          }
          exercisesByPart2.get(part2Key).push(exercise);
        }

        // ラウンドロビン方式で選択（各part2から順番に1つずつ）
        let hasMore = true;
        let roundIndex = 0;
        const part2Keys = Array.from(exercisesByPart2.keys());

        while (hasMore && remainingTime > 0) {
          hasMore = false;

          for (const part2Key of part2Keys) {
            const exercisesInGroup = exercisesByPart2.get(part2Key);
            const currentCount = usedPart2Count.get(part2Key) || 0;

            // このグループからまだ選べる種目があるか
            if (currentCount < exercisesInGroup.length) {
              const exercise = exercisesInGroup[currentCount];

              if (exercise.time_minutes <= remainingTime) {
                selectedExercises.push(exercise);
                remainingTime -= exercise.time_minutes;
                usedPart2Count.set(part2Key, currentCount + 1);
                hasMore = true; // まだ選べる可能性がある
              }
            }
          }

          roundIndex++;
          // 無限ループ防止（最大100周）
          if (roundIndex > 100) break;
        }

        rotationExercises.push(...selectedExercises);
      }
    } else {
      // 時間上限が未設定の場合は従来通り（各部位から1つずつ）
      for (const bodyPartId of bodyPartIds) {
        const [exercises] = await pool.query(`
          SELECT e.*, bp.name as body_part_name
          FROM exercises e
          JOIN body_parts bp ON e.body_part_id = bp.id
          WHERE e.user_id = ? AND e.body_part_id = ? AND e.frequency_type = 'rotation'
          ORDER BY e.last_performed_at IS NULL DESC, e.last_performed_at ASC
          LIMIT 1
        `, [req.session.userId, bodyPartId]);
        if (exercises.length > 0) {
          rotationExercises.push(exercises[0]);
        }
      }
    }

    const allExercises = [...requiredExercises, ...rotationExercises];

    // 部位(1)でソート（同じ部位の種目が連続するように）
    allExercises.sort((a, b) => {
      if (a.body_part_id !== b.body_part_id) {
        return a.body_part_id - b.body_part_id;
      }
      // 同じ部位の場合は元の順序を維持
      return 0;
    });

    const totalTime = allExercises.reduce((sum, e) => sum + (e.time_minutes || 0), 0);

    res.json({
      cycle_day: currentDay,
      is_rest_day: false,
      body_parts: bodyPartNames,
      exercises: allExercises,
      total_time: totalTime,
      max_time_minutes: maxTimeMinutes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ワークアウト記録 ====================
// ワークアウト完了
app.post('/api/workout/complete', requireAuth, async (req, res) => {
  const { exercise_ids } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 現在のサイクル日を取得
    const [userRows] = await conn.query('SELECT current_cycle_day FROM users WHERE id = ?', [req.session.userId]);
    const currentDay = userRows[0].current_cycle_day;

    // ワークアウトログを作成
    const [logResult] = await conn.query(
      'INSERT INTO workout_logs (user_id, workout_date, cycle_day) VALUES (?, CURDATE(), ?)',
      [req.session.userId, currentDay]
    );
    const logId = logResult.insertId;

    // 各種目の詳細を記録
    for (const exerciseId of exercise_ids) {
      await conn.query(
        'INSERT INTO workout_log_details (workout_log_id, exercise_id) VALUES (?, ?)',
        [logId, exerciseId]
      );
      // last_performed_atを更新
      await conn.query(
        'UPDATE exercises SET last_performed_at = NOW() WHERE id = ?',
        [exerciseId]
      );
    }

    // サイクル日を進める
    const nextDay = currentDay >= 7 ? 1 : currentDay + 1;
    await conn.query('UPDATE users SET current_cycle_day = ? WHERE id = ?', [nextDay, req.session.userId]);

    await conn.commit();
    res.json({ success: true, next_cycle_day: nextDay });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// スキップ（サイクルだけ進める）
app.post('/api/workout/skip', requireAuth, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT current_cycle_day FROM users WHERE id = ?', [req.session.userId]);
    const currentDay = userRows[0].current_cycle_day;
    const nextDay = currentDay >= 7 ? 1 : currentDay + 1;

    await pool.query('UPDATE users SET current_cycle_day = ? WHERE id = ?', [nextDay, req.session.userId]);
    res.json({ success: true, next_cycle_day: nextDay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 履歴 ====================
app.get('/api/history', requireAuth, async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT wl.id, wl.workout_date, wl.cycle_day, wl.created_at
      FROM workout_logs wl
      WHERE wl.user_id = ?
      ORDER BY wl.workout_date DESC, wl.created_at DESC
      LIMIT 50
    `, [req.session.userId]);

    // 各ログの詳細を取得
    for (const log of logs) {
      const [details] = await pool.query(`
        SELECT e.name, bp.name as body_part_name
        FROM workout_log_details wld
        JOIN exercises e ON wld.exercise_id = e.id
        JOIN body_parts bp ON e.body_part_id = bp.id
        WHERE wld.workout_log_id = ?
      `, [log.id]);
      log.exercises = details;
      log.body_parts = [...new Set(details.map(d => d.body_part_name))];
    }

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
