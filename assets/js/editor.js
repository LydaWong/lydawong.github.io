// ===== 块编辑器 =====
// ===== 块编辑器 =====
const blockIcon = { text: '¶', image: '▣', video: '▷', audio: '♪', link: '↗' };
const blockName = { text: '文字', image: '图片', video: '视频', audio: '语音', link: '网址' };
const blockPlaceholder = {
  text: '写一段文字……',
  image: '图片地址 https://… 或 data:image/…',
  video: '视频地址：B站/YouTube 链接，或 mp4/webm 直链',
  audio: '语音地址 https://…/*.mp3',
  link: '网址 https://…'
};

function fmtSize(bytes) {
  return bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}
function setBlockInfo(block, msg, kind) {
  const info = block.querySelector('.block-file-info');
  if (!info) return;
  info.textContent = msg;
  info.className = 'block-file-info ' + (kind || '');
  info.style.display = 'block';
}

// 添加一个块到写作面板（type=类型；data=已有块数据；at=插入到某块之前，null=末尾）
function addBlock(type, data, at) {
  const list = document.getElementById('blockList');
  const block = document.createElement('div');
  block.className = 'editor-block eb-' + type;
  block.dataset.type = type;
  let inner = '';
  if (type === 'text') {
    const text = data && data.text ? data.text : '';
    inner = `<textarea class="eb-text" rows="3" placeholder="${blockPlaceholder.text}">${escapeHtml(text)}</textarea>`;
  } else {
    const url = data && data.url ? data.url : '';
    const caption = data && data.caption ? data.caption : '';
    const localable = ['image', 'video', 'audio'].includes(type);
    const accept = { image: 'image/*', video: 'video/*', audio: 'audio/*' }[type] || '';
    inner = `
      ${localable ? `<button type="button" class="eb-local-btn" onclick="this.nextElementSibling.click()">从本地选择${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}文件</button>
      <input type="file" class="eb-file-input" accept="${accept}" style="display:none" onchange="handleBlockFile(this)">` : ''}
      <input type="text" class="eb-url" value="${escapeHtml(url)}" placeholder="${blockPlaceholder[type]}">
      <input type="text" class="eb-caption" value="${escapeHtml(caption)}" placeholder="说明文字（可选）">
      <div class="block-file-info" style="display:none"></div>`;
  }
  block.innerHTML = `
    <div class="eb-main">
      <div class="eb-head"><span class="eb-type">${blockIcon[type]} ${blockName[type]}</span>
        <span class="eb-ctrl">
          <button type="button" class="eb-up" onclick="moveBlock(this,-1)" title="上移">↑</button>
          <button type="button" class="eb-down" onclick="moveBlock(this,1)" title="下移">↓</button>
          <button type="button" class="eb-del" onclick="removeBlock(this)" title="删除">✕</button>
        </span>
      </div>
      ${inner}
    </div>`;
  if (at && at.parentNode === list) list.insertBefore(block, at);
  else list.appendChild(block);
  if (type === 'text' && !(data && data.text)) setTimeout(() => block.querySelector('.eb-text').focus(), 30);
  if (type !== 'text' && /^data:/i.test((data && data.url) || '')) setBlockInfo(block, '已内嵌本地文件', 'ok');
  return block;
}

function moveBlock(btn, dir) {
  const block = btn.closest('.editor-block');
  const sibling = dir < 0 ? block.previousElementSibling : block.nextElementSibling;
  if (sibling) {
    if (dir < 0) block.parentNode.insertBefore(block, sibling);
    else block.parentNode.insertBefore(sibling, block);
  }
}
function removeBlock(btn) { btn.closest('.editor-block').remove(); }
function clearBlocks() { document.getElementById('blockList').innerHTML = ''; }

// 读取本地文件：图片压缩，音视频直读为 data URI
function handleBlockFile(input) {
  const block = input.closest('.editor-block');
  const file = input.files && input.files[0];
  if (!file) return;
  const type = block.dataset.type;
  const urlInput = block.querySelector('.eb-url');
  setBlockInfo(block, '正在读取 ' + file.name + ' …', '');
  const reader = new FileReader();
  reader.onerror = () => setBlockInfo(block, '读取失败，请重试', 'warn');
  if (type === 'image') {
    reader.onload = e => compressImage(e.target.result, file.type, ok => {
      if (!ok) { setBlockInfo(block, '图片处理失败，可改用图片直链', 'warn'); return; }
      urlInput.value = ok.data;
      const warn = ok.data.length > 1.2e6;
      setBlockInfo(block, `${file.name} · 压缩后 ${fmtSize(ok.bytes)}${warn ? '（偏大，建议换更小的图）' : '，已内嵌'}`, warn ? 'warn' : 'ok');
    });
    reader.readAsDataURL(file);
  } else {
    const limit = 4 * 1024 * 1024;
    if (file.size > limit) setBlockInfo(block, `${file.name} · ${fmtSize(file.size)} 过大，建议改用直链或图床`, 'warn');
    reader.onload = e => {
      urlInput.value = e.target.result;
      if (file.size <= limit) setBlockInfo(block, `${file.name} · ${fmtSize(file.size)}，已内嵌`, 'ok');
    };
    reader.readAsDataURL(file);
  }
}

// 图片压缩到最长边 1280，输出 JPEG
function compressImage(dataUrl, mimeType, cb) {
  const img = new Image();
  img.onload = () => {
    try {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (mimeType === 'image/png') ctx.fillStyle = '#fff', ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', 0.82);
      cb({ data: out, bytes: Math.round(out.length * 0.75) });
    } catch (e) { cb(null); }
  };
  img.onerror = () => cb(null);
  img.src = dataUrl;
}

// 收集当前所有块数据
function collectBlocks() {
  return [...document.querySelectorAll('#blockList .editor-block')].map(block => {
    const type = block.dataset.type;
    if (type === 'text') return { type: 'text', text: block.querySelector('.eb-text').value.trim() };
    return {
      type,
      url: block.querySelector('.eb-url').value.trim(),
      caption: block.querySelector('.eb-caption').value.trim()
    };
  }).filter(b => b.type === 'text' ? b.text : b.url);
}


// ===== 写文章 / 编辑文章 =====
// ===== 写文章 / 编辑文章：弹窗 =====
let editingId = null;   // null=新建，否则为正在编辑的文章 id

function setWriteMode(mode) {
  if (mode === 'edit') {
    document.getElementById('writeEyebrow').textContent = 'EDIT POST';
    document.getElementById('writeModalTitle').textContent = '编辑文章';
    document.getElementById('writeModalDesc').textContent = '修改后保存，已发布的文章会标记为「待发布」，点「发布」同步给所有人。';
    document.getElementById('writeSubmitBtn').textContent = '保存修改';
  } else {
    document.getElementById('writeEyebrow').textContent = 'NEW POST';
    document.getElementById('writeModalTitle').textContent = '写一篇新文章';
    document.getElementById('writeModalDesc').textContent = '写好后保存到本地，会立即出现在首页。想让所有人看到，点「发布」同步到线上。';
    document.getElementById('writeSubmitBtn').textContent = '保存到博客';
  }
}

function openWriteModal() {
  if (!requireOwner()) return;
  editingId = null;
  setWriteMode('new');
  document.getElementById('writeForm').reset();
  document.getElementById('wEmoji').value = '✎';
  clearBlocks();
  addBlock('text');   // 默认给一个文字块
  showWriteModal();
}
function openEditModal(id) {
  if (!requireOwner()) return;
  const a = allArticles.find(x => String(x.id) === String(id) && !isTrashed(x));
  if (!a) { showToast('文章不存在'); return; }
  editingId = String(id);
  setWriteMode('edit');
  document.getElementById('wTitle').value = a.title || '';
  document.getElementById('wTag').value = a.tag || '思考';
  document.getElementById('wEmoji').value = a.emoji || '✎';
  document.getElementById('wExcerpt').value = a.excerpt || '';
  clearBlocks();
  const blocks = getBlocks(a);
  if (blocks.length) blocks.forEach(b => addBlock(b.type === 'text' ? 'text' : b.type, b));
  else addBlock('text');
  closeModal();  // 若从详情弹窗点编辑，先关闭详情
  showWriteModal();
}
function showWriteModal() {
  document.getElementById('writeModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('wTitle').focus(), 100);
}
function closeWriteModal() {
  document.getElementById('writeModal').classList.remove('show');
  document.body.style.overflow = '';
  editingId = null;
}

// ===== 保存文章（新建 / 编辑）=====
function saveArticle(e) {
  e.preventDefault();
  if (!requireOwner()) return false;
  const title = document.getElementById('wTitle').value.trim();
  const tag = document.getElementById('wTag').value;
  const emoji = document.getElementById('wEmoji').value.trim() || '✎';
  const excerpt = document.getElementById('wExcerpt').value.trim();
  const blocks = collectBlocks();
  const hasText = blocks.some(b => b.type === 'text');
  if (!title || !excerpt || !hasText) {
    showToast('请把标题、摘要写好，并至少添加一个文字块');
    return false;
  }
  const totalChars = blocks.filter(b => b.type === 'text').reduce((s, b) => s + (b.text || '').length, 0);
  const readTime = Math.max(1, Math.ceil(totalChars / 300)) + ' 分钟';

  if (editingId) {
    // 编辑已有文章：更新所有数据源中的对应项
    const sid = editingId;
    const today = new Date().toISOString().slice(0, 10);
    let wasPublished = false;
    [userArticles, onlineArticles].forEach(arr => {
      const a = arr.find(x => String(x.id) === sid);
      if (a) {
        wasPublished = wasPublished || !!a.published || arr === onlineArticles;
        a.title = title; a.tag = tag; a.emoji = emoji; a.excerpt = excerpt;
        a.readTime = readTime;
        applyBlocks(a, blocks);            // 同步写入 blocks + content/media 兼容字段
        a.date = a.date || today;          // 创作日期保持不变 → 位置稳定
        a.updatedAt = today;               // 记录本次更新日期
        if (wasPublished) a.dirty = true;   // 已发布的改动标记为待发布
      }
    });
    // 如果文章只在 onlineArticles（内置文章），需同步到 userArticles 以便后续发布
    const inUser = userArticles.find(x => String(x.id) === sid);
    if (!inUser) {
      const src = onlineArticles.find(x => String(x.id) === sid);
      if (src) userArticles.unshift({...src, dirty: true, published: true});
    }
    const saved = persistRaw();
    recompose();
    closeWriteModal();
    if (saved) showToast(wasPublished ? '已保存修改，点「发布」同步给所有人' : '已保存修改');
  } else {
    const article = {
      id: 'u' + Date.now(), title, tag, emoji, excerpt,
      date: new Date().toISOString().slice(0, 10), readTime, published: false
    };
    applyBlocks(article, blocks);
    userArticles.unshift(article);
    const saved = persistUserArticles();
    closeWriteModal();
    if (saved) showToast('已保存到本地，点「发布」可让所有人看到');
  }
  return false;
}
