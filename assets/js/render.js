// ===== 渲染文章列表（排除回收站） =====
// ===== 渲染文章列表（排除回收站）=====
function renderArticles() {
  const grid = document.getElementById('articleGrid');
  // 按日期稳定排序：编辑只改内容不改日期，因此文章始终停留在原来的位置
  const visible = allArticles.filter(a => !isTrashed(a))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const filtered = currentTag === 'all' ? visible : visible.filter(a => a.tag === currentTag);
  grid.innerHTML = filtered.map((a, i) => {
    const isLocal = String(a.id).startsWith('u') && !a.published;
    const isDirty = !!a.dirty;
    return `
    <article class="post-card" onclick="openArticle('${a.id}')">
      <div class="post-cover cover-${a.tag}">
        <span class="post-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="post-icon">${escapeHtml(a.emoji)}</span>
        <div class="post-actions">
          <button class="post-action-btn edit" title="编辑文章" onclick="event.stopPropagation(); openEditModal('${a.id}')">${editSvg}</button>
          <button class="post-action-btn delete" title="删除到回收站" onclick="event.stopPropagation(); moveToTrash('${a.id}')">${trashSvg}</button>
        </div>
      </div>
      <div class="post-body">
        <div class="post-top">
          <span class="post-tag"># ${a.tag}${isLocal ? '<span class="post-local">本地</span>' : ''}${isDirty ? '<span class="post-dirty">待发布</span>' : ''}</span>
          <span class="post-date"><span class="date-created">创作 ${a.date}</span>${a.updatedAt ? `<span class="date-updated">更新 ${a.updatedAt}</span>` : ''}</span>
        </div>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.excerpt)}</p>
        <div class="post-foot">
          <span>${a.readTime}阅读</span>
          <span class="post-arrow">${arrowSvg}</span>
        </div>
      </div>
    </article>`;
  }).join('');
  document.querySelectorAll('.post-card').forEach((el, i) => {
    el.classList.add('reveal');
    setTimeout(() => el.classList.add('visible'), 25 * i);
  });
}

// ===== 更新统计 =====
function updateStats() {
  const visible = allArticles.filter(a => !isTrashed(a));
  document.getElementById('postCount').textContent = visible.length;
  const totalWords = visible.reduce((sum, a) => sum + getBlocks(a).filter(b => b.type === 'text').reduce((s, b) => s + (b.text || '').length, 0), 0);
  document.getElementById('wordCount').textContent = totalWords > 999 ? (totalWords / 1000).toFixed(1) + 'k' : totalWords;
}


// ===== 筛选标签 =====
// ===== 筛选标签 =====
function setupFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTag = btn.dataset.tag;
      renderArticles();
    });
  });
}


// ===== 媒体渲染（安全 URL + 各类型播放器） =====
// ===== 媒体渲染（安全 URL + 各类型播放器）=====
function safeMediaUrl(url) {
  const s = String(url || '').trim();
  // 只允许 http(s) 与安全类型 data URI（图片/视频/音频），杜绝 javascript: 等注入
  return /^(https?:\/\/|data:(image\/(png|jpe?g|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime)|audio\/(mpeg|mp3|wav|mp4|ogg|aac|x-wav));base64,)/i.test(s) ? s : '';
}

// 从各种视频网址解析出可嵌入的 iframe；返回空串表示用直链 <video>
function videoEmbed(url) {
  // B站：BV 号或 av 号
  const bv = url.match(/bilibili\.com\/video\/(BV[\w]+)/i) || url.match(/(BV[0-9A-Za-z]{10})/);
  if (bv) {
    return `<iframe class="media-iframe" src="https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bv[1])}&high_quality=1&autoplay=0" scrolling="no" frameborder="0" allowfullscreen></iframe>`;
  }
  const av = url.match(/bilibili\.com\/video\/av(\d+)/i);
  if (av) {
    return `<iframe class="media-iframe" src="https://player.bilibili.com/player.html?aid=${av[1]}&high_quality=1&autoplay=0" scrolling="no" frameborder="0" allowfullscreen></iframe>`;
  }
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) {
    return `<iframe class="media-iframe" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt[1])}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  return '';
}

// 迷你波形条（纯装饰）
const waveBars = `<span class="ap-wave">${Array.from({length:11},(_,i)=>`<i style="height:${[6,9,14,8,16,10,6,13,9,5,11][i]}px"></i>`).join('')}</span>`;

// 从 URL 提取域名，用于链接引用条
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e) { return String(url).replace(/^https?:\/\//, '').split('/')[0]; }
}

// 渲染单个媒体块（推荐方案一样式）
function renderMediaBlock(m, idx) {
  const url = safeMediaUrl(m.url);
  if (!url) return '';
  const eu = escapeHtml(url);
  let body = '';
  if (m.type === 'image') {
    // ① 画框照：白边装裱 + 圆角阴影 + 居中
    const cap = m.caption ? `<figcaption class="mf-cap">${escapeHtml(m.caption)}</figcaption>` : '';
    body = `<figure class="mf-frame"><div class="mf-frame-inner"><img src="${eu}" alt="${escapeHtml(m.caption || '文章图片')}" loading="lazy"></div>${cap}</figure>`;
  } else if (m.type === 'video') {
    const embed = videoEmbed(url);
    const cap = m.caption ? `<figcaption class="mf-cap">${escapeHtml(m.caption)}</figcaption>` : '';
    if (embed) {
      // ① 封面卡：限宽居中 + 圆角卡片
      body = `<figure class="mf-vcard"><div class="mf-vcard-stage">${embed}</div>${cap}</figure>`;
    } else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || /^data:video\//i.test(url)) {
      body = `<figure class="mf-vcard"><div class="mf-vcard-stage"><video class="mf-video" src="${eu}" controls preload="metadata">你的浏览器不支持视频播放</video></div>${cap}</figure>`;
    } else {
      body = renderLinkBlock(url, m.caption || '观看视频', '▶');
    }
  } else if (m.type === 'audio') {
    if (/\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url) || /^data:audio\//i.test(url)) {
      // ① 迷你胶囊：圆按钮 + 标题 + 波形 + 时长（标题已含 caption，不再重复）
      const label = escapeHtml(m.caption || '语音');
      body = `<figure class="mf-apill-wrap"><div class="mf-apill">
        <button type="button" class="mf-apill-btn" data-audio="${idx}" aria-label="播放">${playSvg}</button>
        <span class="mf-apill-name">♪ ${label}</span>
        ${waveBars}
        <span class="mf-apill-time" data-time="${idx}">0:00</span>
        <audio data-audio-src="${idx}" src="${eu}" preload="metadata">你的浏览器不支持音频播放</audio>
      </div></figure>`;
    } else {
      body = renderLinkBlock(url, m.caption || '收听语音', '♪');
    }
  } else if (m.type === 'link') {
    body = renderLinkBlock(url, m.caption || '相关链接', '↗');
  }
  return body;
}

// ① 引用条：左侧色条 + 标题 + 域名 + 提示
function renderLinkBlock(url, caption, icon) {
  const eu = escapeHtml(url);
  const host = escapeHtml(hostOf(url));
  return `<figure class="mf-quote"><a href="${eu}" target="_blank" rel="noopener noreferrer">
    <div class="mf-quote-top"><b>${escapeHtml(caption || '相关链接')}</b><span class="mf-quote-host">${host}</span></div>
    <div class="mf-quote-desc">点击查看 · ${icon} 打开新窗口</div>
  </a></figure>`;
}

// 播放图标 SVG
const playSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
const pauseSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

// 按块顺序渲染整篇文章正文（文字与媒体交错混排）
function renderArticleBody(a) {
  const blocks = getBlocks(a);
  let mediaIdx = 0;
  return blocks.map(b => {
    if (b.type === 'text') return `<p class="article-p">${escapeHtml(b.text || '')}</p>`;
    const html = renderMediaBlock(b, mediaIdx);
    mediaIdx++;
    return html;
  }).join('');
}

// 绑定迷你音频播放器（每次打开详情后调用）
function bindAudioPlayers(root) {
  const audios = (root || document).querySelectorAll('audio[data-audio-src]');
  audios.forEach(audio => {
    const idx = audio.getAttribute('data-audio-src');
    const btn = (root || document).querySelector('.mf-apill-btn[data-audio="' + idx + '"]');
    const timeEl = (root || document).querySelector('.mf-apill-time[data-time="' + idx + '"]');
    if (!btn) return;
    const fmt = s => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    audio.addEventListener('loadedmetadata', () => { if (timeEl) timeEl.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', () => { if (timeEl) timeEl.textContent = fmt(audio.currentTime); });
    audio.addEventListener('ended', () => { btn.innerHTML = playSvg; btn.classList.remove('playing'); });
    btn.addEventListener('click', () => {
      if (audio.paused) {
        audios.forEach(other => { if (other !== audio) { other.pause(); const ob = (root || document).querySelector('.mf-apill-btn[data-audio="' + other.getAttribute('data-audio-src') + '"]'); if (ob) { ob.innerHTML = playSvg; ob.classList.remove('playing'); } } });
        audio.play().then(() => { btn.innerHTML = pauseSvg; btn.classList.add('playing'); }).catch(() => showToast('播放失败，请检查音频地址'));
      } else {
        audio.pause(); btn.innerHTML = playSvg; btn.classList.remove('playing');
      }
    });
  });
}
