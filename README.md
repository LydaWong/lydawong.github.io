# lydawong.github.io
## 权限说明

站点是纯静态托管，没有后端，因此「谁能写」最终由 GitHub 账号决定：

- **访客**：只能阅读文章、分享、在评论区（Disqus）留言。页面不渲染任何写作入口。
- **博主**：点页脚版权后的小锁图标（或按 `Ctrl / Cmd + Shift + L`），粘贴对该仓库有写权限的 GitHub Token 解锁；解锁后才出现「写文章 / 发布 / 回收站 / 编辑 / 删除」。

Token 只存在浏览器 localStorage，不会写进网页源码。真正拦人的是 GitHub 的鉴权——没有 Token 就提交不了 `posts.json`。

建议新建 Fine-grained Token：

- Repository access：仅 `LydaWong/lydawong.github.io`
- Permissions：`Contents: Read and write`（其余留空）
- 有效期按需，过期后重新生成即可

Token 失效或被撤销后，页面会自动退回访客视图。
