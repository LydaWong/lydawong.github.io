// ===== 应用入口 =====
// ===== 初始化 =====
function init() {
  initAuth();          // 先定身份：默认访客只读，博主解锁后才放出写作入口
  renderArticles();
  updateStats();
  setupFilters();
  setupTheme();
  setupNavScroll();
  setupReveal();
  setupProgress();
  document.getElementById('writeBtn').addEventListener('click', openWriteModal);
  document.getElementById('publishBtn').addEventListener('click', openPublishModal);
  document.getElementById('trashBtn').addEventListener('click', openTrashModal);
  loadOnlineArticles();
}

// 启动
init();
