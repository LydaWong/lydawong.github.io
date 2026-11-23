// ===== Toast 提示 =====
// ===== Toast 提示 =====
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== canvas 绘图工具（海报用） =====
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// 文本按像素宽度换行，限制行数
function wrapText(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(String(text || ''));
  const lines = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) {
    lines.push(line);
    if (lines.length === maxLines && chars.join('').length > lines.join('').length) {
      // 末行省略号
      let last = lines[lines.length - 1];
      while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) last = last.slice(0, -1);
      lines[lines.length - 1] = last + '…';
    }
  }
  return lines;
}
