// ===== 发布逻辑 =====
// ================= 发布逻辑 =================

function readConfigForm() {
  return {
    owner: document.getElementById('cfgOwner').value.trim(),
    repo: document.getElementById('cfgRepo').value.trim(),
    branch: document.getElementById('cfgBranch').value.trim() || 'main',
    token: document.getElementById('cfgToken').value.trim()
  };
}

function openPublishModal() {
  if (!requireOwner()) return;
  const cfg = getConfig();
  document.getElementById('cfgOwner').value = cfg.owner || '';
  document.getElementById('cfgRepo').value = cfg.repo || '';
  document.getElementById('cfgBranch').value = cfg.branch || 'main';
  document.getElementById('cfgToken').value = cfg.token || '';
  const configured = !!(cfg.owner && cfg.repo && cfg.token);
  document.getElementById('publishConfig').style.display = configured ? 'none' : 'flex';
  document.getElementById('publishReady').style.display = configured ? 'flex' : 'none';
  if (configured) document.getElementById('readyRepo').textContent = cfg.owner + '/' + cfg.repo + ' (' + cfg.branch + ')';
  document.getElementById('publishStatus').style.display = 'none';
  updatePublishUI();
  document.getElementById('publishModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closePublishModal() {
  document.getElementById('publishModal').classList.remove('show');
  document.body.style.overflow = '';
}
function editConfig() {
  if (!requireOwner()) return;
  document.getElementById('publishConfig').style.display = 'flex';
  document.getElementById('publishReady').style.display = 'none';
}

function updatePublishUI() {
  const fresh = userArticles.filter(a => !a.published && !isTrashed(a)).length;
  const updated = allArticles.filter(a => a.dirty && !isTrashed(a)).length;
  const pending = fresh + updated;
  const badge = document.getElementById('publishBadge');
  badge.textContent = pending;
  badge.style.display = pending > 0 ? 'flex' : 'none';
  const pc = document.getElementById('pendingCount');
  if (pc) pc.textContent = pending;
  const pendingBox = document.getElementById('publishPending');
  if (pendingBox) {
    pendingBox.style.display = pending > 0 ? 'flex' : 'none';
    const parts = [];
    if (fresh) parts.push(fresh + ' 篇新文章');
    if (updated) parts.push(updated + ' 篇修改待更新');
    const msgEl = pendingBox.querySelector('span');
    if (msgEl) msgEl.innerHTML = '检测到 <b id="pendingCount">' + pending + '</b> 篇待发布' + (parts.length ? '（' + parts.join('、') + '）' : '');
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('publishStatus');
  el.className = 'publish-status ' + (type || '');
  el.innerHTML = msg;
  el.style.display = 'block';
}
function setPublishing(on) {
  const btn = document.getElementById('doPublishBtn');
  btn.disabled = on;
  document.getElementById('doPublishText').textContent = on ? '发布中…' : '确认发布';
}


// ===== 核心：发布本地文章到 GitHub =====
// ===== 核心：发布本地文章到 GitHub =====
async function doPublish() {
  if (!requireOwner()) return;
  const cfg = readConfigForm();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    showStatus('请填写 GitHub 用户名、仓库名和 Token（<a href="PUBLISH_GUIDE.md" target="_blank" style="text-decoration:underline">如何获取？</a>）', 'error');
    return;
  }
  saveConfig(cfg);
  setPublishing(true);
  showStatus('正在连接 GitHub 读取线上文章库…', 'info spinner');

  const api = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/posts.json';
  const headers = {
    'Authorization': 'Bearer ' + cfg.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    let sha = null;
    const getRes = await fetch(api + '?ref=' + encodeURIComponent(cfg.branch), { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      onlineArticles = JSON.parse(base64ToUtf8(data.content));
    } else if (getRes.status !== 404) {
      const err = await getRes.json().catch(() => ({}));
      throw new Error('读取失败（HTTP ' + getRes.status + '）：' + (err.message || '请检查用户名、仓库名与 Token 权限'));
    }

    // 合并所有文章：本地优先（本地含最新编辑），线上补充；提交前清除 dirty 标记
    const toPublish = dedupe([...userArticles, ...onlineArticles]).map(a => { const c = {...a}; delete c.dirty; return c; });
    const content = JSON.stringify(toPublish, null, 2);
    const body = {
      message: '发布博客文章 · ' + new Date().toLocaleString('zh-CN'),
      content: utf8ToBase64(content),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;

    showStatus('正在提交文章到仓库…', 'info spinner');
    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error('提交失败（HTTP ' + putRes.status + '）：' + (err.message || '未知错误'));
    }

    userArticles.forEach(a => { a.published = true; delete a.dirty; });
    onlineArticles = toPublish;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));
    recompose();

    const sitePath = cfg.repo.endsWith('.github.io') ? '' : cfg.repo;
    const url = 'https://' + cfg.owner + '.github.io/' + (sitePath ? sitePath + '/' : '');
    showStatus('✓ 发布成功！约 1 分钟后所有人可见：<br><a href="' + url + '" target="_blank" style="text-decoration:underline">' + url + '</a>', 'success');

    document.getElementById('publishConfig').style.display = 'none';
    document.getElementById('publishReady').style.display = 'flex';
    document.getElementById('readyRepo').textContent = cfg.owner + '/' + cfg.repo + ' (' + cfg.branch + ')';
  } catch (e) {
    showStatus('发布失败：' + escapeHtml(e.message) + '<br>请检查配置后重试。', 'error');
  } finally {
    setPublishing(false);
  }
}
