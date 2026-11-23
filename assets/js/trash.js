// ===== 回收站逻辑 =====
// ================= 回收站逻辑 =================

// 找文章所在的数据源
function locateArticle(id) {
  const sid = String(id);
  const inUser = userArticles.findIndex(a => String(a.id) === sid);
  const inOnline = onlineArticles.findIndex(a => String(a.id) === sid);
  return { inUser, inOnline, article: (inUser >= 0 ? userArticles : onlineArticles)[inUser >= 0 ? inUser : inOnline] };
}

// 删除 → 移入回收站
function moveToTrash(id) {
  const { inUser, inOnline, article } = locateArticle(id);
  if (!article) { showToast('文章不存在'); return; }
  if (!confirm('删除「' + article.title + '」？\n文章会进入回收站，保留 30 天，期间可恢复。')) return;

  const now = Date.now();
  if (inUser >= 0) userArticles[inUser].deletedAt = now;
  if (inOnline >= 0) onlineArticles[inOnline].deletedAt = now;

  // 已发布的文章删除需要同步线上
  const needSync = inOnline >= 0 || article.published;
  if (inUser >= 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));

  closeModal();
  if (needSync) {
    syncToGitHub('删除文章（移入回收站）').then(ok => {
      recompose();
      showToast(ok ? '已移入回收站，线上同步完成' : '已移入回收站（线上同步失败，下次发布时会重试）');
    });
  } else {
    recompose();
    showToast('已移入回收站');
  }
}

// 恢复文章
function restoreArticle(id) {
  const { inUser, inOnline } = locateArticle(id);
  if (inUser < 0 && inOnline < 0) { showToast('文章不存在'); return; }
  if (inUser >= 0) delete userArticles[inUser].deletedAt;
  if (inOnline >= 0) delete onlineArticles[inOnline].deletedAt;

  const article = (inUser >= 0 ? userArticles : onlineArticles)[inUser >= 0 ? inUser : inOnline];
  const needSync = inOnline >= 0 || article.published;
  if (inUser >= 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));

  if (needSync) {
    syncToGitHub('恢复文章').then(ok => {
      recompose();
      showToast(ok ? '已恢复文章，线上同步完成' : '已恢复（线上同步失败，下次发布时会重试）');
    });
  } else {
    recompose();
    showToast('已恢复文章');
  }
}

// 彻底销毁单篇
function destroyArticle(id) {
  const { inUser, inOnline, article } = locateArticle(id);
  if (!article) { showToast('文章不存在'); return; }
  if (!confirm('彻底销毁「' + article.title + '」？\n此操作不可恢复！')) return;

  const needSync = inOnline >= 0 || article.published;
  if (inUser >= 0) userArticles.splice(inUser, 1);
  if (inOnline >= 0) onlineArticles.splice(inOnline, 1);

  if (needSync) {
    syncToGitHub('彻底销毁文章').then(ok => {
      recompose();
      showToast(ok ? '已彻底销毁，线上同步完成' : '本地已销毁（线上同步失败，下次发布时会重试）');
    });
  } else {
    recompose();
    showToast('已彻底销毁');
  }
}

// 清理超过 30 天的回收站文章（每次 recompose 调用）
function purgeExpired() {
  const now = Date.now();
  let changedOnline = false;
  const before = onlineArticles.length;
  onlineArticles = onlineArticles.filter(a => !isTrashed(a) || (now - a.deletedAt) < TRASH_MS);
  if (onlineArticles.length !== before) changedOnline = true;
  const beforeU = userArticles.length;
  userArticles = userArticles.filter(a => !isTrashed(a) || (now - a.deletedAt) < TRASH_MS);
  if (userArticles.length !== beforeU) localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));
  if (changedOnline) {
    // 有线上文章到期，异步同步（有 token 配置时）
    const cfg = getConfig();
    if (cfg.owner && cfg.repo && cfg.token) syncToGitHub('自动清理过期回收站文章');
  }
}

// 打开回收站
function openTrashModal() {
  renderTrash();
  document.getElementById('trashModal').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeTrashModal() {
  document.getElementById('trashModal').classList.remove('show');
  document.body.style.overflow = '';
}

function renderTrash() {
  const list = document.getElementById('trashList');
  const trashed = allArticles.filter(isTrashed).sort((a, b) => b.deletedAt - a.deletedAt);
  if (!trashed.length) {
    list.innerHTML = `
      <div class="trash-empty">
        <div class="empty-icon">${trashSvg}</div>
        <b>回收站是空的</b>
        <span>删除的文章会出现在这里</span>
      </div>`;
    return;
  }
  const now = Date.now();
  list.innerHTML = trashed.map(a => {
    const daysPassed = (now - a.deletedAt) / 86400000;
    const daysLeft = Math.max(0, Math.ceil(TRASH_DAYS - daysPassed));
    const urgent = daysLeft <= 7;
    return `
      <div class="trash-item">
        <div class="trash-item-icon cover-${a.tag}">${escapeHtml(a.emoji)}</div>
        <div class="trash-item-main">
          <div class="trash-item-title">${escapeHtml(a.title)}</div>
          <div class="trash-item-meta">
            ${a.tag} · 剩余 <span class="trash-days ${urgent ? 'urgent' : ''}">${daysLeft} 天</span> 后自动销毁
          </div>
        </div>
        <div class="trash-item-actions">
          <button class="trash-action restore" onclick="restoreArticle('${a.id}')">${restoreSvg} 恢复</button>
          <button class="trash-action destroy" onclick="destroyArticle('${a.id}')">销毁</button>
        </div>
      </div>`;
  }).join('');
}

function updateTrashUI() {
  const count = allArticles.filter(isTrashed).length;
  const badge = document.getElementById('trashBadge');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
  const footer = document.getElementById('trashFooter');
  if (footer) footer.style.display = count > 0 ? 'flex' : 'none';
  const note = document.getElementById('trashFooterNote');
  if (note) note.textContent = count > 0 ? '共 ' + count + ' 篇，销毁后不可恢复' : '';
}

// 清空回收站
function emptyTrash() {
  const count = allArticles.filter(isTrashed).length;
  if (!count) { showToast('回收站已是空的'); return; }
  if (!confirm('确定清空回收站吗？\n这 ' + count + ' 篇文章将被彻底销毁，无法恢复！')) return;

  // 判断是否有线上文章需要同步
  const trashedOnline = onlineArticles.filter(isTrashed).length;
  userArticles = userArticles.filter(a => !isTrashed(a));
  onlineArticles = onlineArticles.filter(a => !isTrashed(a));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userArticles));

  if (trashedOnline > 0) {
    syncToGitHub('清空回收站').then(ok => {
      recompose();
      showToast(ok ? '回收站已清空，线上同步完成' : '本地已清空（线上同步失败，下次发布时会重试）');
    });
  } else {
    recompose();
    showToast('回收站已清空');
  }
}
