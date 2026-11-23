// ===== 打开文章 =====
// ===== 打开文章 =====
function openArticle(id) {
  const a = allArticles.find(x => String(x.id) === String(id) && !isTrashed(x));
  if (!a) return;
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="modal-cover cover-${a.tag}">${escapeHtml(a.emoji)}</div>
    <span class="modal-tag"># ${a.tag}</span>
    <h2>${escapeHtml(a.title)}</h2>
    <div class="modal-meta">创作 ${a.date} · 约 ${a.readTime}阅读${a.updatedAt ? ` · <span class="meta-updated">更新 ${a.updatedAt}</span>` : ''}</div>
    ${a.dirty ? '<div class="dirty-notice">' + restoreSvg + '这篇文章有未发布的修改，点「发布」后所有人才能看到更新。</div>' : ''}
    <div class="article-body">${renderArticleBody(a)}</div>
    <div class="article-share">
      <div class="share-title">${shareSvg} 分享这篇文章</div>
      <div class="share-btns">
        <button class="share-btn primary" onclick="shareCopyLink()">${linkSvg} 复制文章链接</button>
        <button class="share-btn" onclick="shareExportPdf()">${pdfSvg} 导出 PDF</button>
        <button class="share-btn" onclick="shareToWeibo()">${weiboSvg} 分享到微博</button>
        <button class="share-btn" onclick="sharePoster()">${posterSvg} 生成分享海报</button>
      </div>
      <div class="share-note" id="shareNote">每篇文章都有独立链接，发给别人即可直接打开这篇。</div>
    </div>
    ${renderComments(a)}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="openEditModal('${a.id}')">${editSvg} 编辑文章</button>
      <button class="btn btn-ghost danger" onclick="moveToTrash('${a.id}')">${trashSvg} 删除文章</button>
    </div>
  `;
  currentArticleId = a.id;
  bindAudioPlayers(body);
  loadDisqus(a);
  updateShareNote(a);
  writePostHash(a.id);
  document.getElementById('articleModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// ===== 评论区（Disqus）与关闭弹窗 =====
// ===== 评论区（Disqus）=====
// 静态博客所有文章共用一个页面，用文章 id 作为 Disqus 讨论标识，保证每篇文章有独立评论串。
function articleDisqusId(a) { return 'qinghe-' + String(a.id); }

function renderComments(a) {
  const head = `<div class="comment-head">${commentSvg} <span>评论</span></div>`;
  if (!DISQUS_SHORTNAME) {
    return `<section class="comment-section">
      ${head}
      <div class="comment-off">
        <div class="comment-off-ico">${commentSvg}</div>
        <b>评论区待开启</b>
        <p>博主还没配置评论。开启后，读者就能在这里留言互动啦。</p>
      </div>
    </section>`;
  }
  // 已配置：Disqus 会把评论区渲染进 #disqus_thread
  return `<section class="comment-section">
    ${head}
    <div id="disqus_thread" class="disqus-thread"></div>
    <noscript>请启用 JavaScript 以查看评论。</noscript>
  </section>`;
}

// 打开文章后初始化/切换 Disqus 讨论（单页应用需 reset 而非重复加载脚本）
let disqusReady = false;
let disqusCurrentId = null;
function loadDisqus(a) {
  if (!DISQUS_SHORTNAME) return;
  const id = articleDisqusId(a);
  const configure = function () {
    this.page.identifier = id;
    this.page.url = location.origin + location.pathname + '#post-' + encodeURIComponent(id);
    this.page.title = a.title;
    this.language = 'zh';
  };
  if (!disqusReady) {
    window.disqus_config = configure;
    const s = document.createElement('script');
    s.id = 'disqus-embed';
    s.src = 'https://' + encodeURIComponent(DISQUS_SHORTNAME) + '.disqus.com/embed.js';
    s.setAttribute('data-timestamp', String(+new Date()));
    s.async = true;
    s.onerror = () => {
      const t = document.getElementById('disqus_thread');
      if (t) t.innerHTML = '<div class="comment-off"><b>评论加载失败</b><p>请检查网络，或确认 Disqus 短名是否正确。</p></div>';
    };
    (document.head || document.body).appendChild(s);
    disqusReady = true;
    disqusCurrentId = id;
  } else if (window.DISQUS && disqusCurrentId !== id) {
    // 切换文章：重置到该文章的讨论串
    window.DISQUS.reset({ reload: true, config: configure });
    disqusCurrentId = id;
  }
}
function closeModal() {
  document.getElementById('articleModal').classList.remove('show');
  document.body.style.overflow = '';
  currentArticleId = null;
  clearPostHash();
}
