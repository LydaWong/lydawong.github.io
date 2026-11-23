// ===== 分享功能（永久链接 / PDF / 微博 / 海报） =====
// ===== 分享功能（永久链接 / PDF / 微博 / 海报）=====
// 永久链接用 URL hash：#post=<id>。别人打开带 hash 的地址会自动定位到那篇文章。
function postUrl(id) {
  const base = location.origin + location.pathname;
  return base + '#post=' + encodeURIComponent(String(id));
}
function writePostHash(id) {
  if (suppressHash) return;
  const target = '#post=' + encodeURIComponent(String(id));
  if (location.hash !== target) history.replaceState(null, '', location.pathname + location.search + target);
}
function clearPostHash() {
  if (suppressHash) return;
  if (/^#post=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
}
// 页面加载时若带 #post=，数据就绪后自动打开对应文章
function openFromHash() {
  const m = location.hash.match(/^#post=(.+)$/);
  if (!m) return;
  let id;
  try { id = decodeURIComponent(m[1]); } catch (e) { return; }
  const a = allArticles.find(x => String(x.id) === String(id) && !isTrashed(x));
  if (a) {
    suppressHash = true;
    openArticle(a.id);
    suppressHash = false;
  }
}
// 浏览器前进/后退时，按 hash 打开或关闭文章
window.addEventListener('hashchange', () => {
  if (suppressHash) return;
  const m = location.hash.match(/^#post=(.+)$/);
  if (m) {
    let id;
    try { id = decodeURIComponent(m[1]); } catch (e) { return; }
    const a = allArticles.find(x => String(x.id) === String(id) && !isTrashed(x));
    if (a && String(currentArticleId) !== String(a.id)) openArticle(a.id);
  } else if (currentArticleId) {
    // hash 被清掉：关闭弹窗（不递归清 hash）
    document.getElementById('articleModal').classList.remove('show');
    document.body.style.overflow = '';
    currentArticleId = null;
  }
});

// 判断文章是否已发布（线上 posts.json 里有这篇，别人才打开得了）
function isArticlePublished(a) {
  return onlineArticles.some(x => String(x.id) === String(a.id)) || !!a.published;
}

// 分享区提示：本地未发布的文章提醒别人打不开
function updateShareNote(a) {
  const note = document.getElementById('shareNote');
  if (!note) return;
  note.textContent = isArticlePublished(a)
    ? '这篇文章已发布，复制链接发给别人即可直接打开。'
    : '这篇还没发布：链接可复制，但别人暂时打不开，点「发布」后即可分享给所有人。';
}

// 复制文章链接（带降级方案，兼容 file:// 与非安全上下文）
async function shareCopyLink() {
  const a = allArticles.find(x => String(x.id) === String(currentArticleId));
  if (!a) return;
  const url = postUrl(a.id);
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      ok = true;
    }
  } catch (e) { /* 走降级 */ }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
  }
  if (ok) {
    showToast(isArticlePublished(a) ? '链接已复制，发给别人即可打开' : '链接已复制（注意：这篇还没发布）');
  } else {
    prompt('复制下面的文章链接：', url);
  }
}

// 导出 PDF：临时只显示正文，调浏览器打印，用户选「另存为 PDF」
function shareExportPdf() {
  const a = allArticles.find(x => String(x.id) === String(currentArticleId));
  if (!a) return;
  document.body.classList.add('pdf-exporting');
  const finish = () => {
    document.body.classList.remove('pdf-exporting');
    window.removeEventListener('afterprint', finish);
  };
  window.addEventListener('afterprint', finish);
  // 兜底：部分浏览器不触发 afterprint
  setTimeout(finish, 4000);
  showToast('在打印窗口选「另存为 PDF」即可保存');
  setTimeout(() => window.print(), 120);
}

// 分享到微博
function shareToWeibo() {
  const a = allArticles.find(x => String(x.id) === String(currentArticleId));
  if (!a) return;
  const url = postUrl(a.id);
  const title = (a.title || '我的博客') + ' · 杂记';
  const weibo = 'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url)
    + '&title=' + encodeURIComponent(title);
  window.open(weibo, '_blank', 'noopener,noreferrer,width=680,height=520');
}

// 生成分享海报（canvas 绘制：标题/摘要/日期/二维码）
function sharePoster() {
  const a = allArticles.find(x => String(x.id) === String(currentArticleId));
  if (!a) return;
  if (typeof QRCode === 'undefined') { showToast('海报组件未加载，请刷新页面重试'); return; }
  const url = postUrl(a.id);
  const W = 750, H = 1180;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 背景
  ctx.fillStyle = '#FBFAF7';
  ctx.fillRect(0, 0, W, H);
  // 顶部色带
  const grad = ctx.createLinearGradient(0, 0, W, 220);
  grad.addColorStop(0, '#C25E3C'); grad.addColorStop(1, '#A94E30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 220);
  // 站点名
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 26px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillText('青 禾 记', 60, 80);
  ctx.font = '400 15px ' + getComputedStyle(document.body).fontFamily;
  ctx.globalAlpha = .8;
  ctx.fillText('记录生活 · 技术 · 思考', 60, 116);
  ctx.globalAlpha = 1;
  // 大 emoji
  ctx.font = '88px serif';
  ctx.fillText(a.emoji || '✎', 60, 200);

  // 分类标签
  const tag = a.tag || '生活';
  ctx.font = '700 18px ' + getComputedStyle(document.body).fontFamily;
  const tagW = ctx.measureText('# ' + tag).width + 32;
  ctx.fillStyle = '#F6E9E2';
  roundRect(ctx, 60, 268, tagW, 40, 20); ctx.fill();
  ctx.fillStyle = '#C25E3C';
  ctx.fillText('# ' + tag, 76, 295);

  // 标题（自动换行）
  ctx.fillStyle = '#1C1B19';
  ctx.font = 'bold 46px ' + (getComputedStyle(document.documentElement).getPropertyValue('--serif') || 'serif');
  let ty = 370;
  const titleLines = wrapText(ctx, a.title || '', W - 120, 3);
  titleLines.forEach(line => { ctx.fillText(line, 60, ty); ty += 62; });

  // 摘要（自动换行）
  ctx.fillStyle = '#6A655E';
  ctx.font = '400 24px ' + getComputedStyle(document.body).fontFamily;
  let ey = ty + 14;
  const exLines = wrapText(ctx, a.excerpt || '', W - 120, 4);
  exLines.forEach(line => { ctx.fillText(line, 60, ey); ey += 40; });

  // 分隔线
  ctx.strokeStyle = '#EBE7DF'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, H - 320); ctx.lineTo(W - 60, H - 320); ctx.stroke();

  // 二维码
  const qrSize = 180;
  const qrBox = document.createElement('div');
  qrBox.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;padding:8px;';
  document.body.appendChild(qrBox);
  new QRCode(qrBox, { text: url, width: qrSize, height: qrSize, colorDark: '#1C1B19', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
  // qrcodejs 在支持 canvas 的浏览器里生成 <canvas>，否则生成 <img>
  const qrCanvas = qrBox.querySelector('canvas');
  const qrImg = qrBox.querySelector('img');
  const qrSource = qrCanvas || qrImg;
  if (qrSource) {
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, 60, H - 290, qrSize + 16, qrSize + 16, 12); ctx.fill();
    try { ctx.drawImage(qrSource, 68, H - 282, qrSize, qrSize); } catch (e) { /* 图片未就绪则跳过 */ }
  }
  qrBox.remove();

  // 右侧文案
  ctx.fillStyle = '#1C1B19';
  ctx.font = '600 26px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillText('扫码阅读原文', 290, H - 200);
  ctx.fillStyle = '#8A867E';
  ctx.font = '400 19px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillText('创作 ' + (a.date || ''), 290, H - 158);
  if (a.readTime) ctx.fillText('约 ' + a.readTime + '阅读', 290, H - 126);
  ctx.fillStyle = '#C25E3C';
  ctx.font = '600 18px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillText('qinghe · blog', 60, H - 44);

  // 显示海报弹窗
  const dataUrl = cv.toDataURL('image/png');
  document.getElementById('posterImg').src = dataUrl;
  document.getElementById('posterImg').dataset.url = dataUrl;
  document.getElementById('posterModal').classList.add('show');
}
function closePosterModal() { document.getElementById('posterModal').classList.remove('show'); }
function downloadPoster() {
  const img = document.getElementById('posterImg');
  if (!img.dataset.url) return;
  const a = document.createElement('a');
  a.href = img.dataset.url;
  a.download = '杂记-分享海报.png';
  document.body.appendChild(a); a.click(); a.remove();
  showToast('海报已保存');
}
// canvas 圆角矩形

// 画布工具 roundRect/wrapText 见 utils.js
