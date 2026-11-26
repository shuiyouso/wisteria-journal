# 部署到 GitHub Pages

## 前提

- 有一个 GitHub 账号
- 已经装了 Git（或者在网页上上传也行）

## 方式一：直接覆盖仓库（推荐，和旧站同一个地址）

旧站地址是 `https://shuiyouso.github.io/wisteria-journal/`，说明仓库叫 `wisteria-journal`。

```bash
git clone https://github.com/shuiyouso/wisteria-journal.git
cd wisteria-journal

# 把新版本的文件复制进来（保留 .git 目录）
# 解压后把 wisteria-journal 里的全部文件拷到仓库根目录

git add -A
git commit -m "重构：三模块 + 心情花笺 + 新备份格式"
git push origin main
```

等 1–2 分钟，打开 `https://shuiyouso.github.io/wisteria-journal/` 即可。

> **重要**：旧记录不在仓库里，在你的浏览器 IndexedDB 里。
> 只要域名不变（还是 `shuiyouso.github.io/wisteria-journal/`），新版本打开后旧记录会**自动出现**，不用导入。
> 换了仓库名或换成自定义域名，就等于换了数据存储位置，旧记录不会跟着走 —— 这时先从旧站导出 JSON，再在新站导入。

## 方式二：新建一个仓库，先并行验证

1. GitHub 新建仓库，例如 `wisteria-journal-v2`
2. 把文件推上去
3. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，Branch 选 `main` / `root`
4. 访问 `https://<用户名>.github.io/wisteria-journal-v2/`
5. 旧站导出的 JSON 在新站「备份 → 恢复数据」里导入
6. 确认无误后，再决定要不要换回主地址

## 方式三：网页上传（不会用 Git 时）

1. 打开仓库页面 → `Add file` → `Upload files`
2. 把解压后的**文件**（不是外层文件夹）拖进去
3. Commit
4. Pages 设置同上

## 注意事项

- 必须是 `main` 分支根目录（或 `docs/`），否则 Pages 找不到 `index.html`
- 文件名区分大小写，`assets` 不要改成 `Assets`
- 更新后如果页面没变，按 `Ctrl+F5` 强制刷新，或等 1–2 分钟 CDN 缓存
- 不要把备份的 JSON 提交到仓库 —— 那里面有你的私人记录

## 换手机 / 换浏览器怎么办

IndexedDB 不跨设备同步。换设备时：

1. 旧设备：备份 → 导出全部数据（JSON）
2. 新设备：打开同一个网址 → 备份 → 恢复数据 → 选那个 JSON

图片也在 JSON 里，会一起过去。
