'use strict';
/* redeploy trigger 2 */

/* =========================================================
   0. CONFIG(環境切替はここだけ書き換える)
   ========================================================= */
var CONFIG = {
  submitFlowUrl: "https://defaultb002272c5b77459a82c753598c4aa5.11.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/24/workflows/b5b203b449c64f7fb70d4fe473d4798f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FBizjvKpSsO6nTLv8tvKMViOivpJ7mjPywpg11m7rIw",
  listFlowUrl: "https://defaultb002272c5b77459a82c753598c4aa5.11.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/30/workflows/028daf86462f486a96e132cdb5cbd1af/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=IMuiZ5TfJ2rWTXqkwUcu0OPtFzZraqAi-zQPRWmx2kc",
  deadline: "2026-07-24",
  version: "v2.0.0-demo",
  demoMode: false // true: 常にデモモード / false: 常に実環境(Power Automateフロー経由)として動作
};

/* =========================================================
   1. デモモード判定
   CONFIG.demoMode フラグで制御
   ========================================================= */
var DEMO_MODE = CONFIG.demoMode === true;

var FILE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
var FILE_EXTENSIONS = { zip: '.zip', md: '.md', pptx: '.pptx' };
var FILE_FIXED_NAMES = { zip: 'source.zip', md: 'report.md', pptx: 'slides.pptx' };
var NAME_FORBIDDEN_CHARS = /[\\\/:*?"<>|#%&{}~]/g;

var DEMO_CURRENT_USER = { title: 'デモ太郎' };
var LOCAL_SHIMEI_KEY = 'wgPortalShimei';

function loadLocalShimei() {
  try { return localStorage.getItem(LOCAL_SHIMEI_KEY) || ''; } catch (e) { return ''; }
}
function saveLocalShimei(name) {
  try { localStorage.setItem(LOCAL_SHIMEI_KEY, name); } catch (e) { /* ignore */ }
}
function currentShimei() {
  return DEMO_MODE ? DEMO_CURRENT_USER.title : loadLocalShimei();
}

/* =========================================================
   2. デモ用サンプルデータ
   ステータス3パターン・レシピ有無・自分の投稿有無を再現
   ========================================================= */
var demoReportSamples = {
  1: "# 議事録要約くん\n\n## 概要\nTeams会議の文字起こしから議事録を自動生成します。\n\n## 使い方\n1. 文字起こしテキストを貼り付け\n2. 「要約」ボタンを押す\n3. 担当者・期限つきの議事録が出力される\n\n```text\n入力: 会議の文字起こし\n出力: Markdown形式の議事録\n```\n",
  2: "# COBOL差分ビジュアライザ\n\n新旧COBOLソースの差分をブロック単位で可視化するツールです。\n\n- 変更行のハイライト\n- COPY句展開後の比較にも対応\n",
  4: "# 社内FAQ検索bot\n\n社内規程PDFを検索対象にしたQAボットです。\n\n## 構成\n- ベクトル検索 + LLM要約\n",
  5: "# 見積書自動生成\n\n案件情報を入力すると見積書(Excel)を自動生成します。\n",
  6: "# コードレビューアシスタント\n\nPull Requestの差分を読み込み、レビューコメント案を生成します。\n"
};

var demoSeq = 6;
var DEMO_ITEMS = [
  {
    id: 1, title: '議事録要約くん', shimei: '山田太郎', author: '山田太郎',
    gaiyo: 'Teams会議の文字起こしから議事録を自動生成するツールです。長文の会議内容を要点ごとに整理し、担当者と期限を抽出します。',
    recipe: 'あなたは優秀な議事録作成者です。以下の会議文字起こしから、決定事項・担当者・期限を抽出してMarkdown形式で整理してください。\n\n# 制約\n- 発言者名は「氏名(役職)」の形式で記載\n- 未確定事項は「要確認」と明記',
    created: '2026-06-10T09:00:00',
    files: { zip: true, md: true, pptx: true }
  },
  {
    id: 2, title: 'COBOL差分ビジュアライザ', shimei: '佐藤花子', author: '佐藤花子',
    gaiyo: 'COBOLの新旧ソースをCOPY句展開後の状態で比較し、差分をブロック単位でハイライト表示するWebツールです。',
    recipe: '差分比較のロジックはPythonのdifflibをベースに、COBOL特有の桁位置情報を保持したまま差分を出すようプロンプトで指示しています。',
    created: '2026-06-15T14:30:00',
    files: { zip: true, md: true, pptx: false }
  },
  {
    id: 3, title: '申請書OCRチェッカー', shimei: '鈴木一郎', author: '鈴木一郎',
    gaiyo: '紙の申請書をスキャンし、OCRで読み取った内容と入力データを突合してエラー箇所を指摘するツールです。',
    recipe: '',
    created: '2026-06-18T11:20:00',
    files: { zip: true, md: false, pptx: true }
  },
  {
    id: 4, title: '社内FAQ検索bot', shimei: 'デモ太郎', author: 'デモ太郎',
    gaiyo: '社内規程やマニュアルPDFを検索対象にした質問応答ボットです。根拠となった資料へのリンクも返します。',
    recipe: '検索結果の要約時は「資料名・該当ページ」を必ず本文中に明記させるよう指示しています。',
    created: '2026-06-20T10:00:00',
    files: { zip: true, md: true, pptx: true }
  },
  {
    id: 5, title: '見積書自動生成', shimei: '高橋実', author: '高橋実',
    gaiyo: '案件情報(工数・単価・条件)を入力するだけで、見積書のExcelファイルをフォーマット通りに自動生成します。',
    recipe: '見積項目のテンプレートをExcelのセル位置ごと指定し、工数×単価の計算式もその場で埋め込ませています。',
    created: '2026-06-22T16:45:00',
    files: { zip: false, md: true, pptx: true }
  },
  {
    id: 6, title: 'コードレビューアシスタント', shimei: 'デモ太郎', author: 'デモ太郎',
    gaiyo: 'Pull Requestの差分を読み込み、命名・重複・簡素化の観点でレビューコメント案を生成します。',
    recipe: '観点は「正確性」「重複/簡素化」「保守性」の3種類に固定し、それぞれ最大3件までに絞るよう指示しています。',
    created: '2026-06-25T13:10:00',
    files: { zip: true, md: true, pptx: false }
  }
];

/* =========================================================
   3. ユーティリティ
   ========================================================= */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeNameChars(str) {
  return String(str == null ? '' : str).replace(NAME_FORBIDDEN_CHARS, '');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

var FILE_LABELS = { zip: 'ソース', md: 'レポート', pptx: 'スライド' };

function getStatus(files) {
  var missing = ['zip', 'md', 'pptx'].filter(function (key) { return !files[key]; }).map(function (key) { return FILE_LABELS[key]; });
  if (missing.length === 0) return { label: '提出完了', cls: 'complete' };
  return { label: missing.join('・') + '待ち', cls: 'waiting' };
}

function placeholderColor(name) {
  var s = String(name || '');
  var hash = 0;
  for (var i = 0; i < s.length; i++) { hash = (hash * 31 + s.charCodeAt(i)) % 360; }
  return 'hsl(' + hash + ', 55%, 55%)';
}

var REAL_ITEMS = null;
var REAL_DATA_LOADING = false;
var REAL_DATA_ERROR = null;

function getItems() {
  return DEMO_MODE ? DEMO_ITEMS : (REAL_ITEMS || []);
}

function findItem(id) {
  var numId = Number(id);
  var items = getItems();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === numId) return items[i];
  }
  return null;
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('clipboard API unavailable'));
}

var LAST_ERROR_TEXT = '';
function renderErrorBox(code, message) {
  LAST_ERROR_TEXT = 'エラーコード: ' + code + ' / ' + message;
  return '<div class="error-box" role="alert">' +
    '<p class="error-code">エラーコード: ' + escapeHtml(code) + '</p>' +
    '<p class="error-message">' + escapeHtml(message) + '</p>' +
    '<button type="button" class="btn secondary btn-copy" onclick="copyErrorText()">エラー内容をコピー</button>' +
    '</div>';
}
function copyErrorText() {
  copyToClipboard(LAST_ERROR_TEXT).then(function () {
    alert('コピーしました。報告用にお使いください。');
  }).catch(function () {
    alert('コピーに失敗しました。お手数ですが画面のエラーコードを手入力してください。\n' + LAST_ERROR_TEXT);
  });
}

function renderMarkdown(mdText) {
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    try {
      var rawHtml = marked.parse(mdText || '');
      var clean = DOMPurify.sanitize(rawHtml);
      return '<div class="markdown-body">' + clean + '</div>';
    } catch (e) {
      // 解析失敗時は下のフォールバックへ
    }
  }
  return '<pre class="markdown-fallback">' + escapeHtml(mdText || '') + '</pre>';
}

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || '');
      var idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = function () { reject(reader.error || new Error('ファイルの読み込みに失敗しました')); };
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   3.5 Power Automateフロー連携層
   直接SharePointを叩かず、2つのフローURLを呼ぶ
   ========================================================= */
function fetchListData() {
  return fetch(CONFIG.listFlowUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP_' + res.status);
    return res.json();
  }).then(function (data) {
    return (data.items || []).map(function (raw) {
      var attachments = raw.attachments || { zip: null, md: null, pptx: null };
      return {
        id: raw.id,
        title: raw.title || '',
        shimei: raw.shimei || '',
        author: raw.author || raw.shimei || '',
        gaiyo: raw.gaiyo || '',
        recipe: raw.recipe || '',
        created: raw.created || '',
        attachments: attachments,
        files: { zip: !!attachments.zip, md: !!attachments.md, pptx: !!attachments.pptx },
        reportText: raw.reportText || ''
      };
    });
  });
}

function submitToFlow(isEdit, editId, fields, fileState) {
  var submitBtn = document.getElementById('submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = isEdit ? '更新中...' : '送信中...'; }

  var existing = isEdit ? findItem(editId) : null;
  var fileEntries = { zip: null, md: null, pptx: null };
  var conversions = ['zip', 'md', 'pptx'].map(function (key) {
    if (fileState[key + 'Action'] === 'replace' && fileState[key + 'File']) {
      return fileToBase64(fileState[key + 'File']).then(function (b64) {
        fileEntries[key] = { name: FILE_FIXED_NAMES[key], base64: b64 };
      });
    }
    return Promise.resolve();
  });

  Promise.all(conversions).then(function () {
    var payload = {
      action: isEdit ? 'update' : 'create',
      id: isEdit ? existing.id : null,
      shimei: fields.cleanShimei,
      title: fields.cleanTitle,
      gaiyo: fields.gaiyo,
      recipe: fields.recipe,
      files: fileEntries
    };
    return fetch(CONFIG.submitFlowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }).then(function (res) {
    if (!res.ok) throw new Error('送信に失敗しました(HTTP ' + res.status + ')');
    return res.json();
  }).then(function (data) {
    if (!data || data.success !== true) {
      throw new Error((data && data.message) || '送信に失敗しました。');
    }
    saveLocalShimei(fields.cleanShimei);
    var prevFiles = existing ? existing.files : { zip: false, md: false, pptx: false };
    var newFiles = {
      zip: prevFiles.zip || !!fileEntries.zip,
      md: prevFiles.md || !!fileEntries.md,
      pptx: prevFiles.pptx || !!fileEntries.pptx
    };
    if (isEdit) {
      existing.title = fields.cleanTitle;
      existing.gaiyo = fields.gaiyo;
      existing.recipe = fields.recipe;
      existing.files = newFiles;
      navigate('#/app/' + existing.id);
    } else {
      var newItem = {
        id: data.id,
        title: fields.cleanTitle,
        shimei: fields.cleanShimei,
        author: fields.cleanShimei,
        gaiyo: fields.gaiyo,
        recipe: fields.recipe,
        created: new Date().toISOString(),
        attachments: { zip: null, md: null, pptx: null },
        files: newFiles,
        reportText: ''
      };
      if (REAL_ITEMS) REAL_ITEMS.unshift(newItem);
      document.getElementById('app').innerHTML = renderCompleteScreen();
    }
  }).catch(function (err) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isEdit ? '更新する' : '送信する'; }
    var message = (err && err.message) || '送信に失敗しました。時間をおいて再度お試しください。';
    document.getElementById('app').insertAdjacentHTML('afterbegin', renderErrorBox('SUBMIT_FAILED', message));
    window.scrollTo(0, 0);
  });
}

/* =========================================================
   4. ルーター
   #/            一覧
   #/submit      提出フォーム
   #/app/{ID}    詳細
   #/edit/{ID}   編集
   ========================================================= */
function parseHash() {
  var hash = location.hash || '#/';
  var path = hash.replace(/^#/, '');
  if (path === '' || path === '/') return { name: 'list' };
  if (path === '/submit') return { name: 'submit' };
  var appMatch = path.match(/^\/app\/(\d+)$/);
  if (appMatch) return { name: 'detail', id: appMatch[1] };
  var editMatch = path.match(/^\/edit\/(\d+)$/);
  if (editMatch) return { name: 'edit', id: editMatch[1] };
  return { name: 'notfound' };
}

function navigate(hash) {
  if (location.hash === hash) { render(); }
  else { location.hash = hash; }
}

function ensureRealDataLoaded(callback) {
  if (REAL_ITEMS !== null) { callback(); return; }
  if (REAL_DATA_LOADING) return;
  REAL_DATA_LOADING = true;
  fetchListData().then(function (items) {
    REAL_ITEMS = items;
    REAL_DATA_LOADING = false;
    callback();
  }).catch(function (err) {
    REAL_DATA_LOADING = false;
    REAL_DATA_ERROR = { code: 'LOAD_FAILED', message: (err && err.message) || 'データの取得に失敗しました。' };
    callback();
  });
}

function retryLoad() {
  REAL_DATA_ERROR = null;
  REAL_ITEMS = null;
  render();
}

function render() {
  document.getElementById('deadline-label').textContent = '提出期限: ' + CONFIG.deadline;
  document.getElementById('version-label').textContent = CONFIG.version;
  renderBanner();
  var route = parseHash();
  var app = document.getElementById('app');

  if (!DEMO_MODE && route.name !== 'submit') {
    if (REAL_DATA_ERROR) {
      app.innerHTML = renderErrorBox(REAL_DATA_ERROR.code, REAL_DATA_ERROR.message) +
        '<p><button type="button" class="btn" onclick="retryLoad()">再読み込み</button></p>';
      return;
    }
    if (REAL_ITEMS === null) {
      app.innerHTML = '<p>読み込み中...</p>';
      ensureRealDataLoaded(render);
      return;
    }
  }

  if (route.name === 'list') app.innerHTML = renderListView();
  else if (route.name === 'submit') app.innerHTML = renderFormView(null);
  else if (route.name === 'detail') app.innerHTML = renderDetailView(route.id);
  else if (route.name === 'edit') app.innerHTML = renderFormView(route.id);
  else app.innerHTML = renderErrorBox('ROUTE_NOT_FOUND', '指定されたページが見つかりません。URLをご確認ください。') +
    '<p><a href="#/" class="btn">一覧へ戻る</a></p>';
  window.scrollTo(0, 0);
  attachViewHandlers(route);
}

function renderBanner() {
  var banner = document.getElementById('banner');
  if (DEMO_MODE) {
    banner.innerHTML = '<div class="demo-banner">デモモードで表示しています。サンプルデータで画面を確認できますが、実際のSharePointへの送信は行われません。</div>';
  } else {
    banner.innerHTML = '';
  }
}

/* =========================================================
   5. 一覧画面(#/)
   ========================================================= */
function renderListView() {
  var items = getItems().slice().sort(function (a, b) { return new Date(b.created) - new Date(a.created); });
  var totalApps = items.length;
  var submitterSet = {};
  items.forEach(function (it) {
    submitterSet[it.shimei] = true;
  });
  var submitterCount = Object.keys(submitterSet).length;
  var myShimei = currentShimei();

  var cardsHtml = items.map(function (it) {
    var status = getStatus(it.files);
    var initials = (it.shimei || '?').slice(0, 1);
    var isOwn = myShimei !== '' && it.shimei === myShimei;
    var gaiyoText = it.gaiyo && it.gaiyo.trim() !== '' ? escapeHtml(it.gaiyo) : '(アプリ概要は未登録です)';
    return '' +
      '<div class="card">' +
        '<div class="thumb" style="background:' + placeholderColor(it.shimei) + '">' + escapeHtml(initials) + '</div>' +
        '<div class="body">' +
          '<span class="status-badge ' + status.cls + '">' + status.label + '</span>' +
          '<div class="app-name">' + escapeHtml(it.title) + '</div>' +
          '<div class="shimei">' + escapeHtml(it.shimei) + '</div>' +
          '<div class="gaiyo">' + gaiyoText + '</div>' +
          '<div class="actions">' +
            '<a href="#/app/' + it.id + '">詳細を見る</a>' +
            (isOwn ? '<a href="#/edit/' + it.id + '" class="btn secondary">編集</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
  }).join('');

  return '' +
    '<div class="summary-bar">' +
      '<div class="summary-card"><div class="num">' + totalApps + '</div><div class="label">提出アプリ数</div></div>' +
      '<div class="summary-card"><div class="num">' + submitterCount + '</div><div class="label">提出者数</div></div>' +
    '</div>' +
    '<div class="list-toolbar">' +
      '<h1 style="margin:0;font-size:1.2rem;">成果物一覧</h1>' +
      '<a href="#/submit" class="btn">＋ 成果物を提出する</a>' +
    '</div>' +
    '<div class="card-grid">' + (cardsHtml || '<p>まだ提出がありません。</p>') + '</div>';
}

/* =========================================================
   6. 詳細画面(#/app/{ID})
   ========================================================= */
function renderDetailView(idStr) {
  var item = findItem(idStr);
  if (!item) {
    return renderErrorBox('APP_NOT_FOUND', '指定されたアプリが見つかりません。削除されたか、URLが誤っている可能性があります。') +
      '<p><a href="#/" class="btn">一覧へ戻る</a></p>';
  }
  var status = getStatus(item.files);

  var reportHtml;
  if (item.files.md) {
    var mdText = DEMO_MODE
      ? (demoReportSamples[item.id] || ('# ' + item.title + '\n\n(レポート本文のサンプルはありません)'))
      : item.reportText;
    reportHtml = renderMarkdown(mdText);
  } else {
    reportHtml = '<div class="report-placeholder">report.md が未提出です</div>';
  }

  var slideHtml;
  if (item.files.pptx) {
    if (DEMO_MODE) {
      slideHtml = '<div class="slide-placeholder">本番環境接続後、ここからスライドを開けます。</div>';
    } else {
      var pptxEmbedUrl = item.attachments.pptx + '?action=embedview';
      slideHtml = '<div class="slide-embed">' +
          '<iframe src="' + escapeHtml(pptxEmbedUrl) + '" width="100%" height="450" frameborder="0" allowfullscreen></iframe>' +
        '</div>' +
        '<div class="slide-fallback"><a href="' + escapeHtml(item.attachments.pptx) + '" target="_blank" rel="noopener">別タブで開く(SharePointにログイン済みの場合)</a></div>';
    }
  } else {
    slideHtml = '<div class="slide-placeholder">slides.pptx は未提出です(任意・後日提出可)</div>';
  }

  function attachmentLink(key, label) {
    if (!item.files[key]) return '<li>' + label + ': 未提出</li>';
    if (DEMO_MODE) return '<li>' + label + ': 提出済み(デモモードのため実リンクは無効です)</li>';
    return '<li><a href="' + escapeHtml(item.attachments[key]) + '" target="_blank" rel="noopener">' + label + 'を開く</a>(SharePointにログイン済みの場合)</li>';
  }

  return '' +
    '<div class="detail-section detail-header">' +
      '<h1>' + escapeHtml(item.title) + '</h1>' +
      '<div class="detail-meta">氏名: ' + escapeHtml(item.shimei) + ' ／ 提出日: ' + formatDate(item.created) + '</div>' +
      '<span class="status-badge ' + status.cls + '">' + status.label + '</span>' +
    '</div>' +
    '<div class="detail-section">' +
      '<h2>アプリ概要</h2>' +
      (item.gaiyo && item.gaiyo.trim() !== ''
        ? '<div class="pre-wrap">' + escapeHtml(item.gaiyo) + '</div>'
        : '<p style="color:var(--color-muted);">(アプリ概要は未登録です)</p>') +
    '</div>' +
    '<div class="detail-section">' +
      '<h2>プロンプトのレシピ</h2>' +
      (item.recipe && item.recipe.trim() !== ''
        ? '<div class="pre-wrap">' + escapeHtml(item.recipe) + '</div>'
        : '<p style="color:var(--color-muted);">(レシピの登録はありません)</p>') +
    '</div>' +
    '<div class="detail-section">' +
      '<h2>レポート</h2>' + reportHtml +
    '</div>' +
    '<div class="detail-section">' +
      '<h2>スライド</h2>' + slideHtml +
    '</div>' +
    '<div class="detail-section">' +
      '<h2>添付ファイル</h2>' +
      '<ul>' +
        attachmentLink('zip', 'ソースコード(zip)') +
        attachmentLink('md', 'レポート(md)') +
        attachmentLink('pptx', '発表資料(pptx)') +
      '</ul>' +
    '</div>' +
    '<p><a href="#/" class="btn secondary">一覧へ戻る</a></p>';
}

/* =========================================================
   7. 提出フォーム / 編集画面(#/submit, #/edit/{ID})
   ========================================================= */
function renderFormView(editId) {
  var editItem = editId ? findItem(editId) : null;
  if (editId && !editItem) {
    return renderErrorBox('APP_NOT_FOUND', '編集対象のアプリが見つかりません。') +
      '<p><a href="#/" class="btn">一覧へ戻る</a></p>';
  }
  var isEdit = !!editItem;
  var shimeiValue = isEdit ? editItem.shimei : currentShimei();

  var FILE_NOTES = {
    zip: 'APIキー等のシークレットは必ず除いてください。上限50MB。',
    md: '開発を通じて発見したこと・気づき・理解したことをまとめたライトなレポート(Markdown形式)。詳細画面でプレビュー表示されます。',
    pptx: 'レポートをサクッとまとめたスライド(3〜4ページ想定)。'
  };

  function fileRow(fieldKey, label, currentPresent) {
    var note = '<div class="form-note">' + FILE_NOTES[fieldKey] + '</div>';
    if (!isEdit) {
      return '' +
        '<div class="form-row">' +
          '<label>' + label + '</label>' +
          note +
          '<input type="file" name="' + fieldKey + '" id="file-' + fieldKey + '" accept="' + FILE_EXTENSIONS[fieldKey] + '">' +
          '<div class="form-error" id="err-' + fieldKey + '"></div>' +
        '</div>';
    }
    return '' +
      '<div class="form-row">' +
        '<label>' + label + '</label>' +
        note +
        '<div class="file-current">現在: ' + (currentPresent ? '提出済み' : '未提出') + '</div>' +
        '<div class="radio-inline">' +
          '<label><input type="radio" name="' + fieldKey + 'Action" value="keep" checked> 変更しない</label>' +
          '<label><input type="radio" name="' + fieldKey + 'Action" value="replace"> 差し替える</label>' +
        '</div>' +
        '<input type="file" name="' + fieldKey + '" id="file-' + fieldKey + '" accept="' + FILE_EXTENSIONS[fieldKey] + '" disabled>' +
        '<div class="form-error" id="err-' + fieldKey + '"></div>' +
      '</div>';
  }

  return '' +
    '<div class="form-section">' +
      '<h1 style="margin-top:0;font-size:1.2rem;">' + (isEdit ? '成果物を編集' : '成果物を提出') + '</h1>' +
      '<p class="form-note" style="margin-bottom:16px;">' + (isEdit
        ? 'ファイルを差し替えると元のファイルは復元できません'
        : '必須は氏名とアプリ名だけです。他の項目とファイルは、後日このポータルの編集画面からいつでも追記・追加できます。まずは登録だけでもOKです。') + '</p>' +
      '<form id="submission-form" novalidate>' +
        (isEdit ? '<input type="hidden" name="editId" value="' + editItem.id + '">' : '') +
        '<div class="form-row">' +
          '<label>氏名<span class="required">必須</span></label>' +
          '<div class="form-note">' + (isEdit
            ? 'このアプリの初回提出時に確定しており変更できません。'
            : '前回入力した氏名がこのブラウザに保存され、次回以降は自動入力されます。初回提出後は変更できません。') + '</div>' +
          '<input type="text" name="shimei" value="' + escapeHtml(shimeiValue) + '" ' + (isEdit ? 'disabled' : '') + '>' +
          '<div class="form-error" id="err-shimei"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<label>アプリ名<span class="required">必須</span></label>' +
          '<input type="text" name="title" value="' + (isEdit ? escapeHtml(editItem.title) : '') + '">' +
          '<div class="form-error" id="err-title"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<label>アプリ概要</label>' +
          '<div class="form-note">どんなことができるアプリかを書いてください。READMEの流用OK。</div>' +
          '<textarea name="gaiyo" rows="8">' + (isEdit ? escapeHtml(editItem.gaiyo) : '') + '</textarea>' +
          '<div class="form-error" id="err-gaiyo"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<label>プロンプトのレシピ</label>' +
          '<div class="form-note">「これは使えた!」というお気に入りプロンプトの具体例を書いてください。</div>' +
          '<textarea name="recipe" rows="6">' + (isEdit ? escapeHtml(editItem.recipe) : '') + '</textarea>' +
          '<div class="form-error" id="err-recipe"></div>' +
        '</div>' +
        fileRow('zip', 'ソースコード(zip)', isEdit ? editItem.files.zip : false) +
        fileRow('md', 'レポート(md)', isEdit ? editItem.files.md : false) +
        fileRow('pptx', '発表資料(pptx)', isEdit ? editItem.files.pptx : false) +
        '<button type="submit" class="btn" id="submit-btn">' + (isEdit ? '更新する' : '送信する') + '</button>' +
      '</form>' +
    '</div>';
}

function renderCompleteScreen() {
  return '' +
    '<div class="form-section complete-screen">' +
      '<div class="icon">✓</div>' +
      '<h1>提出が完了しました</h1>' +
      '<p>ご提出ありがとうございました。引き続き別のアプリを提出することもできます。</p>' +
      '<div class="complete-actions">' +
        '<button type="button" class="btn" onclick="startAnotherSubmission()">続けて別のアプリを提出</button>' +
        '<a href="#/" class="btn secondary">一覧を見る</a>' +
      '</div>' +
    '</div>';
}

function startAnotherSubmission() {
  document.getElementById('app').innerHTML = renderFormView(null);
  if (location.hash !== '#/submit') { history.replaceState(null, '', '#/submit'); }
  attachViewHandlers({ name: 'submit' });
}

/* =========================================================
   8. イベントハンドラ(フォーム関連)
   ========================================================= */
function attachViewHandlers(route) {
  if (route.name !== 'submit' && route.name !== 'edit') return;
  var form = document.getElementById('submission-form');
  if (!form) return;

  ['zip', 'md', 'pptx'].forEach(function (key) {
    var radios = form.querySelectorAll('input[name="' + key + 'Action"]');
    if (!radios.length) return;
    var fileInput = document.getElementById('file-' + key);
    radios.forEach(function (r) {
      r.addEventListener('change', function (e) {
        fileInput.disabled = e.target.value !== 'replace';
        if (fileInput.disabled) fileInput.value = '';
      });
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleFormSubmit(form, route);
  });
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-error').forEach(function (el) { el.textContent = ''; });
}

function setFieldError(fieldKey, message) {
  var el = document.getElementById('err-' + fieldKey);
  if (el) el.textContent = message;
}

function handleFormSubmit(form, route) {
  clearFormErrors(form);
  var data = new FormData(form);
  var isEdit = route.name === 'edit';
  var hasError = false;

  var shimei = String(data.get('shimei') || '').trim();
  var title = String(data.get('title') || '').trim();
  var gaiyo = String(data.get('gaiyo') || '').trim();
  var recipe = String(data.get('recipe') || '');

  if (!isEdit && shimei === '') { setFieldError('shimei', '氏名を入力してください'); hasError = true; }
  if (title === '') { setFieldError('title', 'アプリ名を入力してください'); hasError = true; }

  function checkFile(key, isReplace) {
    var file = data.get(key);
    var hasFile = file && file.size > 0;
    var ext = FILE_EXTENSIONS[key];
    if (hasFile && file.name.toLowerCase().slice(-ext.length) !== ext) {
      setFieldError(key, ext + '形式のファイルを選択してください');
      hasError = true;
      return null;
    }
    if (hasFile && file.size > FILE_MAX_SIZE) {
      setFieldError(key, 'ファイルが大きすぎます(上限50MB)。node_modules等の依存フォルダが含まれていないか確認してください。');
      hasError = true;
      return null;
    }
    if (isEdit && isReplace && !hasFile) {
      setFieldError(key, '差し替える場合はファイルを選択してください');
      hasError = true;
    }
    return hasFile ? file : null;
  }

  var zipAction = isEdit ? String(data.get('zipAction') || 'keep') : 'replace';
  var mdAction = isEdit ? String(data.get('mdAction') || 'keep') : 'replace';
  var pptxAction = isEdit ? String(data.get('pptxAction') || 'keep') : 'replace';

  var zipFile = checkFile('zip', zipAction === 'replace');
  var mdFile = checkFile('md', mdAction === 'replace');
  var pptxFile = checkFile('pptx', pptxAction === 'replace');

  if (hasError) return;

  var cleanShimei = sanitizeNameChars(shimei);
  var cleanTitle = sanitizeNameChars(title);

  if (DEMO_MODE) {
    if (isEdit) {
      var item = findItem(data.get('editId'));
      item.title = cleanTitle;
      item.gaiyo = gaiyo;
      item.recipe = recipe;
      if (zipAction === 'replace' && zipFile) item.files.zip = true;
      if (mdAction === 'replace' && mdFile) item.files.md = true;
      if (pptxAction === 'replace' && pptxFile) item.files.pptx = true;
      navigate('#/app/' + item.id);
      return;
    }

    demoSeq += 1;
    var newItem = {
      id: demoSeq,
      title: cleanTitle,
      shimei: cleanShimei,
      author: cleanShimei,
      gaiyo: gaiyo,
      recipe: recipe,
      created: new Date().toISOString(),
        files: { zip: !!zipFile, md: !!mdFile, pptx: !!pptxFile }
    };
    DEMO_ITEMS.unshift(newItem);
    document.getElementById('app').innerHTML = renderCompleteScreen();
    return;
  }

  submitToFlow(isEdit, data.get('editId'), { cleanShimei: cleanShimei, cleanTitle: cleanTitle, gaiyo: gaiyo, recipe: recipe },
    { zipAction: zipAction, mdAction: mdAction, pptxAction: pptxAction, zipFile: zipFile, mdFile: mdFile, pptxFile: pptxFile });
}

/* =========================================================
   9. 起動
   ========================================================= */
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
