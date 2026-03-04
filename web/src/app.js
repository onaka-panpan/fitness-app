// API Base URL
const API_BASE = '/api';

// State
let currentPage = 'home';
let currentUser = null;
let bodyParts = [];
let exercises = [];
let rotations = [];

// ==================== 初期化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
});

// ==================== メニュー ====================
function openMenu() {
  document.getElementById('side-menu').classList.add('active');
  document.getElementById('menu-overlay').classList.add('active');
}

function closeMenu() {
  document.getElementById('side-menu').classList.remove('active');
  document.getElementById('menu-overlay').classList.remove('active');
}

// ==================== ナビゲーション ====================
function navigateTo(page, params = {}) {
  closeMenu();
  currentPage = page;

  const pageTitle = {
    'login': 'ログイン',
    'signup': '新規登録',
    'home': '筋トレメニュー',
    'today': '本日のメニュー',
    'exercises': '種目一覧',
    'exercise-detail': params.id ? '種目編集' : '種目登録',
    'rotation': 'ローテーション登録',
    'history': '履歴一覧'
  };

  document.getElementById('page-title').textContent = pageTitle[page] || '筋トレメニュー';

  // ログイン/サインアップ画面ではハンバーガーメニューを非表示
  const hamburger = document.querySelector('.hamburger');
  if (page === 'login' || page === 'signup') {
    hamburger.style.display = 'none';
  } else {
    hamburger.style.display = 'flex';
  }

  switch (page) {
    case 'login':
      renderLogin();
      break;
    case 'signup':
      renderSignup();
      break;
    case 'home':
      renderHome();
      break;
    case 'today':
      renderTodayMenu();
      break;
    case 'exercises':
      renderExerciseList();
      break;
    case 'exercise-detail':
      renderExerciseDetail(params.id);
      break;
    case 'rotation':
      renderRotation();
      break;
    case 'history':
      renderHistory();
      break;
  }
}

// ==================== API ====================
async function api(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // セッションCookieを含める
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch (e) {
      error = { error: 'API Error' };
    }
    // 認証エラーの場合はログイン画面へ
    if (error.requiresAuth) {
      currentUser = null;
      navigateTo('login');
    }
    throw new Error(error.error || 'API Error');
  }
  return response.json();
}

// ==================== 認証 ====================
async function checkAuth() {
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
    await loadBodyParts();
    navigateTo('home');
  } catch (err) {
    currentUser = null;
    navigateTo('login');
  }
}

async function login(username, password) {
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    currentUser = data.user;
    await loadBodyParts();
    navigateTo('home');
    showToast('ログインしました');
  } catch (err) {
    throw err;
  }
}

async function signup(username, password, displayName) {
  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName })
    });
    currentUser = data.user;
    await loadBodyParts();
    navigateTo('home');
    showToast('アカウントを作成しました');
  } catch (err) {
    throw err;
  }
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
    currentUser = null;
    navigateTo('login');
    showToast('ログアウトしました');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

async function loadBodyParts() {
  try {
    bodyParts = await api('/body-parts');
  } catch (err) {
    console.error('Failed to load body parts:', err);
    bodyParts = [];
  }
}

// ==================== ログイン画面 ====================
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <form id="login-form" class="auth-form" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label>ユーザー名</label>
          <input type="text" id="login-username" required autofocus>
        </div>
        <div class="form-group">
          <label>パスワード</label>
          <input type="password" id="login-password" required>
        </div>
        <div id="login-error" class="error-message" style="display: none;"></div>
        <button type="submit" class="btn btn-primary btn-block">ログイン</button>
        <div class="auth-link">
          <a href="#" onclick="navigateTo('signup'); return false;">新規登録はこちら</a>
        </div>
      </form>
    </div>
  `;
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    errorEl.style.display = 'none';
    await login(username, password);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// ==================== サインアップ画面 ====================
function renderSignup() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <form id="signup-form" class="auth-form" onsubmit="handleSignup(event)">
        <div class="form-group">
          <label>ユーザー名 *</label>
          <input type="text" id="signup-username" required autofocus>
        </div>
        <div class="form-group">
          <label>パスワード * (6文字以上)</label>
          <input type="password" id="signup-password" required minlength="6">
        </div>
        <div class="form-group">
          <label>表示名</label>
          <input type="text" id="signup-displayname" placeholder="省略可">
        </div>
        <div id="signup-error" class="error-message" style="display: none;"></div>
        <button type="submit" class="btn btn-primary btn-block">新規登録</button>
        <div class="auth-link">
          <a href="#" onclick="navigateTo('login'); return false;">ログインはこちら</a>
        </div>
      </form>
    </div>
  `;
}

async function handleSignup(event) {
  event.preventDefault();
  const username = document.getElementById('signup-username').value;
  const password = document.getElementById('signup-password').value;
  const displayName = document.getElementById('signup-displayname').value;
  const errorEl = document.getElementById('signup-error');

  try {
    errorEl.style.display = 'none';
    await signup(username, password, displayName);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// ==================== ホーム画面 ====================
function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="home-buttons">
      <button class="home-btn primary" onclick="navigateTo('today')">
        本日のメニュー
      </button>
      <button class="home-btn" onclick="navigateTo('history')">
        履歴一覧
      </button>
      <button class="home-btn" onclick="navigateTo('exercises')">
        種目一覧
      </button>
      <button class="home-btn" onclick="navigateTo('rotation')">
        ローテーション登録
      </button>
    </div>
  `;
}

// ==================== 本日のメニュー画面 ====================
async function renderTodayMenu() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"></div>';

  try {
    const menu = await api('/today-menu');

    if (menu.is_rest_day) {
      app.innerHTML = `
        <div class="today-header">
          <div class="today-date">${formatDate(new Date())}</div>
          <div class="today-cycle">Day ${menu.cycle_day}</div>
        </div>
        <div class="rest-day">
          <div class="rest-day-icon">😴</div>
          <div class="rest-day-text">今日は休息日です</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-block" onclick="skipWorkout()">スキップして次へ</button>
        </div>
      `;
      return;
    }

    const exercisesHtml = menu.exercises.map((e, index) => {
      let mediaThumbnail = '';
      if (e.media_type === 'image' && e.media_content) {
        mediaThumbnail = `
          <div class="exercise-media-thumbnail" data-media-type="image" data-media-content="${e.media_content}" onclick="openMediaModalFromElement(this)">
            <img src="/api/images/${e.media_content}" alt="${e.name}">
          </div>
        `;
      } else if (e.media_type === 'youtube' && e.media_content) {
        // YouTubeのサムネイルを表示（iframe内の動画IDを抽出）
        const youtubeIdMatch = e.media_content.match(/embed\/([a-zA-Z0-9_-]+)/);
        if (youtubeIdMatch) {
          const videoId = youtubeIdMatch[1];
          // HTMLエンティティエスケープ
          const escapedContent = e.media_content
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          mediaThumbnail = `
            <div class="exercise-media-thumbnail youtube" data-media-type="youtube" data-media-content="${escapedContent}" onclick="openMediaModalFromElement(this)">
              <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="${e.name}">
              <div class="youtube-play-icon">▶</div>
            </div>
          `;
        }
      }

      return `
        <div class="exercise-card">
          <div class="exercise-card-content">
            <div class="exercise-card-main" onclick="navigateTo('exercise-detail', { id: ${e.id} })">
              <div class="exercise-card-header">
                <div class="exercise-name">${e.name}</div>
                <div class="exercise-part">${e.part2_name || e.body_part_name}</div>
              </div>
              <div class="exercise-specs">
                <div class="exercise-spec">
                  <div class="exercise-spec-value">${e.weight == 0 ? '自重' : e.weight + 'kg'}</div>
                  <div class="exercise-spec-label">重さ</div>
                </div>
                <div class="exercise-spec">
                  <div class="exercise-spec-value">${e.rm || '-'}</div>
                  <div class="exercise-spec-label">RM</div>
                </div>
                <div class="exercise-spec">
                  <div class="exercise-spec-value">${e.sets || '-'}</div>
                  <div class="exercise-spec-label">SET</div>
                </div>
                <div class="exercise-spec">
                  <div class="exercise-spec-value">${e.time_minutes || '-'}</div>
                  <div class="exercise-spec-label">分</div>
                </div>
              </div>
            </div>
            ${mediaThumbnail}
          </div>
        </div>
      `;
    }).join('');

    // 時間上限の警告メッセージ
    let timeWarningHtml = '';
    if (menu.max_time_minutes && menu.total_time > menu.max_time_minutes) {
      const overTime = menu.total_time - menu.max_time_minutes;
      timeWarningHtml = `
        <div class="time-warning">
          ⚠️ 時間上限（${menu.max_time_minutes}分）を${overTime}分超過しています
        </div>
      `;
    }

    app.innerHTML = `
      <div class="today-header">
        <div class="today-date">${formatDate(new Date())}</div>
        <div class="today-cycle">Day ${menu.cycle_day}</div>
        <div class="today-parts">${menu.body_parts.join(' / ')}</div>
        <div class="today-time">合計 約${menu.total_time}分${menu.max_time_minutes ? ` / ${menu.max_time_minutes}分` : ''}</div>
      </div>
      ${timeWarningHtml}
      <div id="exercise-list">
        ${exercisesHtml}
      </div>
      <div class="btn-group" style="flex-direction: column;">
        <button class="btn btn-success btn-block" onclick="completeWorkout([${menu.exercises.map(e => e.id).join(',')}])">
          完了して記録する
        </button>
        <button class="btn btn-secondary btn-block" onclick="skipWorkout()">
          スキップ（休息）
        </button>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div class="empty-state">エラーが発生しました: ${err.message}</div>`;
  }
}

async function completeWorkout(exerciseIds) {
  try {
    await api('/workout/complete', {
      method: 'POST',
      body: JSON.stringify({ exercise_ids: exerciseIds })
    });
    showToast('トレーニングを記録しました！');
    navigateTo('home');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

async function skipWorkout() {
  try {
    await api('/workout/skip', { method: 'POST' });
    showToast('スキップしました');
    navigateTo('today');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

// ==================== 種目一覧画面 ====================
async function renderExerciseList() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"></div>';

  try {
    exercises = await api('/exercises');

    if (exercises.length === 0) {
      app.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>種目が登録されていません</p>
        </div>
        <button class="btn btn-primary btn-block" onclick="navigateTo('exercise-detail', {})">
          新規登録
        </button>
      `;
      return;
    }

    const listHtml = exercises.map(e => `
      <div class="list-item" onclick="navigateTo('exercise-detail', { id: ${e.id} })">
        <div class="list-item-content">
          <div class="list-item-title">
            ${e.name}
            <span class="badge ${e.frequency_type === 'required' ? 'badge-required' : 'badge-rotation'}">
              ${e.frequency_type === 'required' ? '必須' : 'ローテ'}
            </span>
          </div>
          <div class="list-item-subtitle">${e.body_part_name}${e.part2_name ? ' / ' + e.part2_name : ''}</div>
        </div>
        <div class="list-item-arrow">›</div>
      </div>
    `).join('');

    app.innerHTML = `
      <button class="btn btn-primary btn-block" style="margin-bottom: 16px;" onclick="navigateTo('exercise-detail', {})">
        新規登録
      </button>
      <div id="exercise-list">
        ${listHtml}
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div class="empty-state">エラーが発生しました: ${err.message}</div>`;
  }
}

// ==================== 種目詳細画面 ====================
async function renderExerciseDetail(id) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"></div>';

  let exercise = null;

  if (id) {
    try {
      exercise = await api(`/exercises/${id}`);
    } catch (err) {
      app.innerHTML = `<div class="empty-state">種目が見つかりません</div>`;
      return;
    }
  }

  const bodyPartOptions = bodyParts.map(bp =>
    `<option value="${bp.id}" ${exercise && exercise.body_part_id === bp.id ? 'selected' : ''}>${bp.name}</option>`
  ).join('');

  app.innerHTML = `
    <form id="exercise-form" onsubmit="saveExercise(event, ${id || 'null'})">
      <div class="card">
        <div class="form-group">
          <label>種目名 *</label>
          <input type="text" id="name" value="${exercise?.name || ''}" required>
        </div>

        <div class="form-group">
          <label>部位(1) *</label>
          <select id="body_part_id" required onchange="loadPart2Suggestions()">
            <option value="">選択してください</option>
            ${bodyPartOptions}
          </select>
        </div>

        <div class="form-group">
          <label>部位(2)</label>
          <div class="input-wrapper">
            <input type="text" id="part2_name" value="${exercise?.part2_name || ''}"
                   onfocus="showPart2Suggestions()" onblur="hidePart2Suggestions()">
            <div id="part2-suggestions" class="suggestions" style="display: none;"></div>
          </div>
        </div>

        <div class="form-group">
          <label>実施頻度 *</label>
          <select id="frequency_type" required>
            <option value="required" ${exercise?.frequency_type === 'required' ? 'selected' : ''}>必須</option>
            <option value="rotation" ${!exercise || exercise.frequency_type === 'rotation' ? 'selected' : ''}>ローテーション</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-title">トレーニング設定</div>

        <div class="form-group">
          <label>重さ (kg)</label>
          <div class="number-input">
            <input type="number" id="weight" value="${exercise?.weight || 0}" min="0" step="0.5">
            <span class="unit">kg（0=自重）</span>
          </div>
        </div>

        <div class="form-group">
          <label>RM（最大反復回数）</label>
          <div class="number-input">
            <input type="number" id="rm" value="${exercise?.rm || ''}" min="1">
            <span class="unit">回</span>
          </div>
        </div>

        <div class="form-group">
          <label>セット数</label>
          <div class="number-input">
            <input type="number" id="sets" value="${exercise?.sets || ''}" min="1">
            <span class="unit">セット</span>
          </div>
        </div>

        <div class="form-group">
          <label>所要時間</label>
          <div class="number-input">
            <input type="number" id="time_minutes" value="${exercise?.time_minutes || ''}" min="1">
            <span class="unit">分</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="form-group">
          <label>説明</label>
          <textarea id="description">${exercise?.description || ''}</textarea>
        </div>

        <div class="form-group">
          <label>メディア</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="media_type" value="none" ${!exercise || exercise.media_type === 'none' ? 'checked' : ''} onchange="toggleMediaInput()">
              なし
            </label>
            <label>
              <input type="radio" name="media_type" value="image" ${exercise?.media_type === 'image' ? 'checked' : ''} onchange="toggleMediaInput()">
              画像
            </label>
            <label>
              <input type="radio" name="media_type" value="youtube" ${exercise?.media_type === 'youtube' ? 'checked' : ''} onchange="toggleMediaInput()">
              YouTube
            </label>
          </div>
        </div>

        <div id="media-image" class="form-group" style="display: ${exercise?.media_type === 'image' ? 'block' : 'none'};">
          <label>画像アップロード</label>
          <input type="file" id="image_file" accept="image/*" onchange="handleImageUpload(event)">
          <div id="current-image" style="margin-top: 10px;">
            ${exercise?.media_type === 'image' && exercise?.media_content ? `<img src="/api/images/${exercise.media_content}" style="max-width: 200px; border-radius: 8px;">` : ''}
          </div>
          <input type="hidden" id="media_image_filename" value="${exercise?.media_type === 'image' ? exercise.media_content : ''}">
        </div>

        <div id="media-youtube" class="form-group" style="display: ${exercise?.media_type === 'youtube' ? 'block' : 'none'};">
          <label>YouTube埋め込みコード（iframeタグ全体をペースト）</label>
          <textarea id="media_youtube_content" rows="4" placeholder='<iframe width="560" height="315" src="https://www.youtube.com/embed/..." ...></iframe>'>${exercise?.media_type === 'youtube' ? exercise.media_content : ''}</textarea>
        </div>
      </div>

      <div class="btn-group">
        <button type="submit" class="btn btn-primary">保存</button>
        ${id ? `<button type="button" class="btn btn-danger" onclick="deleteExercise(${id})">削除</button>` : ''}
      </div>
    </form>
  `;

  if (exercise?.body_part_id) {
    loadPart2Suggestions();
  }
}

let part2SuggestionsData = [];

async function loadPart2Suggestions() {
  const bodyPartId = document.getElementById('body_part_id').value;
  if (!bodyPartId) return;

  try {
    part2SuggestionsData = await api(`/part2-suggestions/${bodyPartId}`);
  } catch (err) {
    part2SuggestionsData = [];
  }
}

function showPart2Suggestions() {
  const container = document.getElementById('part2-suggestions');
  if (part2SuggestionsData.length === 0) return;

  container.innerHTML = part2SuggestionsData.map(s =>
    `<div class="suggestion-item" onmousedown="selectPart2Suggestion('${s}')">${s}</div>`
  ).join('');
  container.style.display = 'block';
}

function hidePart2Suggestions() {
  setTimeout(() => {
    document.getElementById('part2-suggestions').style.display = 'none';
  }, 200);
}

function selectPart2Suggestion(value) {
  document.getElementById('part2_name').value = value;
  hidePart2Suggestions();
}

function toggleMediaInput() {
  const mediaType = document.querySelector('input[name="media_type"]:checked').value;
  document.getElementById('media-image').style.display = mediaType === 'image' ? 'block' : 'none';
  document.getElementById('media-youtube').style.display = mediaType === 'youtube' ? 'block' : 'none';
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      throw new Error('画像のアップロードに失敗しました');
    }

    const data = await response.json();
    document.getElementById('media_image_filename').value = data.filename;

    // プレビュー表示
    document.getElementById('current-image').innerHTML =
      `<img src="${data.url}" style="max-width: 200px; border-radius: 8px;">`;

    showToast('画像をアップロードしました');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

async function saveExercise(event, id) {
  event.preventDefault();

  const mediaType = document.querySelector('input[name="media_type"]:checked').value;
  let mediaContent = null;

  if (mediaType === 'image') {
    mediaContent = document.getElementById('media_image_filename').value || null;
  } else if (mediaType === 'youtube') {
    mediaContent = document.getElementById('media_youtube_content').value || null;
  }

  const data = {
    name: document.getElementById('name').value,
    body_part_id: parseInt(document.getElementById('body_part_id').value),
    part2_name: document.getElementById('part2_name').value || null,
    frequency_type: document.getElementById('frequency_type').value,
    weight: parseFloat(document.getElementById('weight').value) || 0,
    rm: parseInt(document.getElementById('rm').value) || null,
    sets: parseInt(document.getElementById('sets').value) || null,
    time_minutes: parseInt(document.getElementById('time_minutes').value) || null,
    description: document.getElementById('description').value || null,
    image_url: null, // 後方互換性のため残す
    media_type: mediaType,
    media_content: mediaContent
  };

  try {
    if (id) {
      await api(`/exercises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      showToast('更新しました');
    } else {
      await api('/exercises', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('登録しました');
    }
    navigateTo('exercises');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

async function deleteExercise(id) {
  if (!confirm('この種目を削除しますか？')) return;

  try {
    await api(`/exercises/${id}`, { method: 'DELETE' });
    showToast('削除しました');
    navigateTo('exercises');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

// ==================== ローテーション登録画面 ====================
async function renderRotation() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"></div>';

  try {
    rotations = await api('/rotations');

    // Day 1-7のデータを構築
    const dayData = {};
    const timeData = {};
    for (let i = 1; i <= 7; i++) {
      const dayRotations = rotations.filter(r => r.day_number === i);
      dayData[i] = dayRotations.map(r => r.body_part_id);
      // 時間上限は同じ日なら全て同じ値なので、最初のものを取得
      timeData[i] = dayRotations.length > 0 ? dayRotations[0].max_time_minutes : null;
    }

    let daysHtml = '';
    for (let day = 1; day <= 7; day++) {
      const checkboxes = bodyParts.map(bp => {
        const checked = dayData[day].includes(bp.id);
        return `
          <label class="checkbox-label ${checked ? 'checked' : ''}" onclick="toggleRotationCheckbox(this)">
            <input type="checkbox" name="day${day}" value="${bp.id}" ${checked ? 'checked' : ''}>
            ${bp.name}
          </label>
        `;
      }).join('');

      daysHtml += `
        <div class="day-card">
          <div class="day-header">Day ${day}${dayData[day].length === 0 ? ' (休息日)' : ''}</div>
          <div class="checkbox-group">
            ${checkboxes}
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label style="font-size: 14px;">時間上限（分）</label>
            <input type="number" name="max_time_day${day}" class="time-limit-input"
                   value="${timeData[day] || ''}" min="1" placeholder="未設定">
          </div>
        </div>
      `;
    }

    app.innerHTML = `
      <form id="rotation-form">
        ${daysHtml}
        <button type="submit" class="btn btn-primary btn-block" style="margin-top: 16px;">保存</button>
      </form>
    `;

    // イベントリスナーを設定
    document.getElementById('rotation-form').addEventListener('submit', saveRotation);
  } catch (err) {
    app.innerHTML = `<div class="empty-state">エラーが発生しました: ${err.message}</div>`;
  }
}

function toggleRotationCheckbox(label) {
  const checkbox = label.querySelector('input');
  setTimeout(() => {
    label.classList.toggle('checked', checkbox.checked);
  }, 0);
}

async function saveRotation(event) {
  event.preventDefault();

  const rotationsData = [];
  for (let day = 1; day <= 7; day++) {
    const checkboxes = document.querySelectorAll(`input[name="day${day}"]:checked`);
    const bodyPartIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const maxTimeInput = document.querySelector(`input[name="max_time_day${day}"]`);
    const maxTimeMinutes = maxTimeInput && maxTimeInput.value ? parseInt(maxTimeInput.value) : null;
    rotationsData.push({
      day_number: day,
      body_part_ids: bodyPartIds,
      max_time_minutes: maxTimeMinutes
    });
  }

  try {
    await api('/rotations', {
      method: 'POST',
      body: JSON.stringify({ rotations: rotationsData })
    });
    showToast('保存しました');
  } catch (err) {
    showToast('エラー: ' + err.message);
  }
}

// ==================== 履歴一覧画面 ====================
async function renderHistory() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading"></div>';

  try {
    const history = await api('/history');

    if (history.length === 0) {
      app.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <p>まだ履歴がありません</p>
        </div>
      `;
      return;
    }

    const historyHtml = history.map(log => {
      const date = new Date(log.workout_date);
      const exerciseNames = log.exercises.map(e => e.name).slice(0, 5).join(', ');

      return `
        <div class="history-item">
          <div class="history-date">${formatDate(date)} (Day ${log.cycle_day})</div>
          <div class="history-parts">
            ${log.body_parts.map(p => `<span class="history-part-tag">${p}</span>`).join('')}
          </div>
          <div class="history-exercises">${exerciseNames}${log.exercises.length > 5 ? '...' : ''}</div>
        </div>
      `;
    }).join('');

    app.innerHTML = historyHtml;
  } catch (err) {
    app.innerHTML = `<div class="empty-state">エラーが発生しました: ${err.message}</div>`;
  }
}

// ==================== ユーティリティ ====================
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  return `${year}/${month}/${day} (${weekday})`;
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==================== メディアモーダル ====================
function openMediaModalFromElement(element) {
  const mediaType = element.getAttribute('data-media-type');
  const mediaContent = element.getAttribute('data-media-content');

  if (mediaType && mediaContent) {
    // HTMLエンティティをデコード
    const decodedContent = mediaContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

    openMediaModal(mediaType, decodedContent);
  }
}

function openMediaModal(type, content) {
  let modal = document.getElementById('media-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'media-modal';
    modal.className = 'media-modal';
    modal.innerHTML = `
      <div class="media-modal-overlay" onclick="closeMediaModal()"></div>
      <div class="media-modal-content">
        <button class="media-modal-close" onclick="closeMediaModal()">&times;</button>
        <div id="media-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const modalBody = document.getElementById('media-modal-body');
  if (type === 'image') {
    modalBody.innerHTML = `<img src="/api/images/${content}" alt="Exercise Image">`;
  } else if (type === 'youtube') {
    modalBody.innerHTML = content;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMediaModal() {
  const modal = document.getElementById('media-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}
