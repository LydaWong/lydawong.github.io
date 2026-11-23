// ===== 数据层 · 全局状态与存储 =====

// 说明：所有本地存储、posts.json 读取、GitHub 读写都集中在 api.js。
// 将来接后端时，只需改造本文件的函数（或 BlogAPI 门面），UI 模块无需改动。

let onlineArticles = [];                        // 线上已发布文章（posts.json）
let userArticles = loadUserArticles();          // 本地文章
let allArticles = [...userArticles, ...defaultArticles];
let currentTag = 'all';
let currentArticleId = null;                    // 当前打开的文章 id（分享/海报用）
let suppressHash = false;                       // 防止 hashchange 回调重复触发

function loadUserArticles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}
// 安全持久化：返回 true/false，超限时友好提示（本地含大体积内嵌媒体时可能触发）
function persistUserArticles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));
    recompose();
    return true;
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(e.message || ''))) {
      showToast('空间已满：内嵌的本地图片/音视频太大，请改用直链或图床地址');
    } else {
      showToast('保存失败，请重试');
    }
    return false;
  }
}
// 供其它逻辑直接写存储用（不触发 recompose）
function persistRaw() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles)); return true; }
  catch (e) { showToast('空间已满，请减小内嵌文件或改用直链'); return false; }
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function dedupe(arr) {
  const map = new Map();
  arr.forEach(a => { if (!map.has(a.id)) map.set(a.id, a); });
  return [...map.values()];
}
function isTrashed(a) { return a && typeof a.deletedAt === 'number'; }

// ===== 块数据兼容层 =====
// ===== 块数据兼容层 =====
// 新结构：article.blocks = [{type:'text',text}, {type:'image'|'video'|'audio'|'link',url,caption}, ...]
// 旧结构：article.content(段落数组) + article.media(媒体数组)
// getBlocks 统一转成块数组，读写都用块，旧数据自动兼容，不破坏已发布内容。
function getBlocks(a) {
  if (!a) return [];
  if (Array.isArray(a.blocks)) return a.blocks;
  const blocks = [];
  (Array.isArray(a.content) ? a.content : []).forEach(text => {
    if (text) blocks.push({ type: 'text', text: String(text) });
  });
  (Array.isArray(a.media) ? a.media : []).forEach(m => {
    if (m && m.url) blocks.push({ type: m.type || 'link', url: m.url, caption: m.caption || '' });
  });
  return blocks;
}
// 从块数组派生出 content / media（写回文章时同步保留旧字段，兼容线上旧版本读取）
function applyBlocks(a, blocks) {
  a.blocks = blocks;
  a.content = blocks.filter(b => b.type === 'text').map(b => b.text);
  a.media = blocks.filter(b => b.type !== 'text').map(b => ({ type: b.type, url: b.url, caption: b.caption || '' }));
}

// ===== 数据合成与加载 =====
// 合并数据并清理过期回收站
function recompose() {
  purgeExpired();
  // posts.json 还没加载完时先用内置文章兜底，避免首屏空白
  const online = onlineArticles.length ? onlineArticles : defaultArticles;
  // 访客只看到线上已发布的文章：本机草稿、未发布的改动只属于博主本人
  allArticles = dedupe(isOwner() ? [...userArticles, ...online] : [...online]);
  renderArticles();
  updateStats();
  updatePublishUI();
  updateTrashUI();
  if (document.getElementById('trashModal').classList.contains('show')) renderTrash();
}

// 加载线上文章库
async function loadOnlineArticles() {
  try {
    const res = await fetch('posts.json?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) onlineArticles = data;
    }
  } catch (e) { /* 本地 file:// 打开时忽略 */ }
  if (!onlineArticles.length) onlineArticles = defaultArticles.map(a => ({...a}));
  recompose();
  openFromHash();   // 带 #post= 的链接直接进入对应文章
}

// ===== GitHub 配置读写 =====
function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveConfig(cfg) { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }

// ===== base64 编解码 =====
// base64 编解码（支持中文）
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function base64ToUtf8(b64) {
  const binary = atob((b64 || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ===== 同步到 GitHub =====
// 通用：把当前线上文章提交到 GitHub
async function syncToGitHub(message) {
  if (!isOwner()) return false;      // 仅博主身份可写入仓库
  const cfg = getConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) return false;
  const api = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/posts.json';
  const headers = {
    'Authorization': 'Bearer ' + cfg.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  try {
    let sha = null;
    const getRes = await fetch(api + '?ref=' + encodeURIComponent(cfg.branch || 'main'), { headers });
    if (getRes.ok) {
      sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
      return false;
    }
    // 提交内容：本地最新状态优先（含编辑与回收站标记），线上补充
    const merged = dedupe([...userArticles, ...onlineArticles]).map(a => { const c = {...a}; delete c.dirty; return c; });
    const content = JSON.stringify(merged, null, 2);
    const body = {
      message: (message || '更新博客文章') + ' · ' + new Date().toLocaleString('zh-CN'),
      content: utf8ToBase64(content),
      branch: cfg.branch || 'main'
    };
    if (sha) body.sha = sha;
    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (putRes.ok) onlineArticles = merged;
    return putRes.ok;
  } catch (e) {
    return false;
  }
}

// ===== BlogAPI 统一门面（将来接后端只改这里） =====

// 这是一个稳定接口：其它模块可直接调用 BlogAPI.xxx()，
// 接后端时把这些方法内部改成 fetch('/api/...') 即可，调用方无需改动。
const BlogAPI = {
  getLocalArticles: () => userArticles.slice(),
  saveLocalArticles: () => persistUserArticles(),
  loadOnlineArticles: () => loadOnlineArticles(),
  getConfig: () => getConfig(),
  saveConfig: (cfg) => saveConfig(cfg),
  syncToGitHub: (msg) => syncToGitHub(msg),
  recompose: () => recompose()
};
