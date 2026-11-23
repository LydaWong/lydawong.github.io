// ===== 应用入口 =====
// ===== 初始化 =====
function init() {
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
