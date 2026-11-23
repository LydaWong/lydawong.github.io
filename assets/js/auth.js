// ===== 权限 · 博主与访客 =====
// 本站是纯静态站点（GitHub Pages），没有服务器，所以「谁有写权限」这件事最终由 GitHub 账号决定：
// 没有对该仓库有写权限的 Token，任何人都改不了线上文章。这一层负责两件事：
//   1) 界面默认按访客渲染：只保留阅读与评论，写作 / 编辑 / 删除 / 发布 / 回收站全部不出现；
//   2) 博主用 Token 解锁（由 GitHub 校验它对该仓库确实有 push 权限）后，才放出这些入口，
//      Token 只存在本机浏览器里，供发布时直接复用。
// 说明：隐藏按钮只是体验层面的隔离，真正的防线是 GitHub 对 Token 的校验 —— 拿不到 Token 就写不进仓库。

// 本站归属的仓库：解锁时只接受对这个仓库有写权限的 Token
const OWNER_ACCOUNT = { owner: 'LydaWong', repo: 'lydawong.github.io', branch: 'main' };

// guest：访客 | pending：本机存有 Token，尚未校验完 | owner：已确认博主身份
let authState = 'guest';

function hasStoredToken() {
  const cfg = getConfig();
  return !!(cfg && cfg.token && cfg.owner && cfg.repo);
}
function isOwner() { return authState !== 'guest'; }

// 统一的操作前置校验：非博主直接拦掉
function requireOwner() {
  if (isOwner()) return true;
  showToast('这是博主的操作，游客只能阅读和评论');
  return false;
}

// ===== 向 GitHub 校验 Token 的写权限 =====
// fatal=true 表示这个 Token 本身不可用（无效 / 过期 / 无此仓库权限），应当清除；
// fatal=false 表示只是网络问题，保留原有凭据，稍后重试即可。
async function verifyOwnerToken(token, owner, repo) {
  const o = owner || OWNER_ACCOUNT.owner;
  const r = repo || OWNER_ACCOUNT.repo;
  const url = 'https://api.github.com/repos/' + encodeURIComponent(o) + '/' + encodeURIComponent(r);
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    return { ok: false, fatal: false, reason: '网络异常，无法连接 GitHub，请稍后重试' };
  }
  if (res.status === 401) return { ok: false, fatal: true, reason: 'Token 无效或已过期，请重新生成' };
  if (res.status === 403) return { ok: false, fatal: true, reason: 'Token 权限不足：需要 Contents 的读与写权限' };
  if (res.status === 404) return { ok: false, fatal: true, reason: '找不到 ' + o + '/' + r + '，或这个 Token 没有该仓库的访问权限' };
  if (!res.ok) return { ok: false, fatal: false, reason: '校验失败（HTTP ' + res.status + '），请稍后重试' };

  const data = await res.json().catch(() => ({}));
  const p = data.permissions || null;
  // GitHub 有返回 permissions 时以它为准；万一没返回，就放行 —— 真正的写入仍会被 GitHub 拦下
  if (p && !(p.push || p.admin || p.maintain)) {
    return { ok: false, fatal: true, reason: '这个 Token 对 ' + o + '/' + r + ' 只有读权限，请勾选 Contents: Read and write' };
  }
  return { ok: true, fatal: false, reason: '' };
}

// ===== 解锁 / 退出 =====
async function unlockWithToken(token) {
  const r = await verifyOwnerToken(token);
  if (!r.ok) return r;
  saveConfig({ owner: OWNER_ACCOUNT.owner, repo: OWNER_ACCOUNT.repo, branch: OWNER_ACCOUNT.branch, token: token });
  authState = 'owner';
  applyRole();
  return r;
}

function logoutOwner(silent) {
  const cfg = getConfig();
  delete cfg.token;
  saveConfig(cfg);
  authState = 'guest';
  applyRole();
  closeAuthModal();
  if (!silent) showToast('已退出博主身份，现在是访客视图');
}

// ===== 身份 → 界面 =====
function applyRole() {
  const owner = isOwner();
  document.body.classList.toggle('role-owner', owner);

  // 博主入口弹窗的两块面板
  const locked = document.getElementById('authLocked');
  const unlocked = document.getElementById('authUnlocked');
  if (locked && unlocked) {
    locked.style.display = owner ? 'none' : 'flex';
    unlocked.style.display = owner ? 'flex' : 'none';
  }
  const entry = document.getElementById('ownerEntry');
  if (entry) {
    entry.title = owner ? '博主身份已解锁，点击管理' : '博主入口';
    entry.classList.toggle('is-unlocked', owner);
  }

  // 访客看不到本机草稿，因此身份变化后要重算文章集合、统计与各入口
  recompose();

  // 从博主退回访客时，把可能开着的写作类弹窗关掉
  if (!owner) {
    if (document.getElementById('writeModal').classList.contains('show')) closeWriteModal();
    if (document.getElementById('publishModal').classList.contains('show')) closePublishModal();
    if (document.getElementById('trashModal').classList.contains('show')) closeTrashModal();
  }
}

// ===== 初始化 =====
function initAuth() {
  // 先按本机凭据定个初值，避免界面来回闪
  authState = hasStoredToken() ? 'pending' : 'guest';
  bindOwnerEntry();
  applyRole();
  if (authState === 'pending') revalidateStoredToken();
}

// 后台复核本机凭据：Token 被撤销或失效就自动降级回访客
async function revalidateStoredToken() {
  const cfg = getConfig();
  const r = await verifyOwnerToken(cfg.token, cfg.owner, cfg.repo);
  if (r.ok) {
    authState = 'owner';
    applyRole();
  } else if (r.fatal) {
    logoutOwner(true);
  }
}

// ===== 博主入口 =====
function bindOwnerEntry() {
  const entry = document.getElementById('ownerEntry');
  if (entry) entry.addEventListener('click', openAuthModal);
  // 键盘快捷入口：Ctrl / Cmd + Shift + L
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      openAuthModal();
    }
  });
}

function openAuthModal() {
  const input = document.getElementById('authToken');
  const status = document.getElementById('authStatus');
  if (input) input.value = '';
  if (status) status.style.display = 'none';
  applyRole();
  document.getElementById('authModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  if (!isOwner() && input) setTimeout(() => input.focus(), 120);
}
function closeAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.classList.remove('show');
  document.body.style.overflow = '';
}

function authStatusMsg(msg, kind) {
  const el = document.getElementById('authStatus');
  if (!el) return;
  el.className = 'publish-status ' + (kind || '');
  el.innerHTML = msg;
  el.style.display = 'block';
}

async function submitAuthToken() {
  const input = document.getElementById('authToken');
  const btn = document.getElementById('authUnlockBtn');
  const token = (input.value || '').trim();
  if (!token) { authStatusMsg('请先粘贴 GitHub Token', 'error'); return; }
  btn.disabled = true;
  btn.textContent = '校验中…';
  authStatusMsg('正在向 GitHub 校验这个 Token 的写权限…', 'info spinner');
  try {
    const r = await unlockWithToken(token);
    if (r.ok) {
      authStatusMsg('✓ 已解锁，你现在是博主身份', 'success');
      input.value = '';
      showToast('已解锁博主身份');
      setTimeout(closeAuthModal, 700);
    } else {
      authStatusMsg(escapeHtml(r.reason), 'error');
    }
  } catch (e) {
    authStatusMsg('校验出错：' + escapeHtml(e.message || '未知错误'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '解锁';
  }
}
