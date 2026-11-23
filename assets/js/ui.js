// ===== 界面交互（主题/导航/动画/进度条/快捷键） =====
// ===== 主题切换 =====
function setupTheme() {
  const btn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  btn.innerHTML = saved === 'dark' ? sunSvg : moonSvg;
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    btn.innerHTML = next === 'dark' ? sunSvg : moonSvg;
  });
}

// ===== 导航滚动高亮 =====
function setupNavScroll() {
  const sections = ['home', 'articles', 'about'];
  const navLinks = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }, { passive: true });
}


function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.section-head.reveal, .about-wrap.reveal').forEach(el => observer.observe(el));
}


function setupProgress() {
  const bar = document.getElementById('progress');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = percent + '%';
  }, { passive: true });
}


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeWriteModal(); closePublishModal(); closeTrashModal(); }
});
