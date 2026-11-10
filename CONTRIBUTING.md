# MINI ClassIsland Admin 贡献指南 (`CONTRIBUTING.md`)

欢迎为 **MINI ClassIsland Admin (`miniclassisland/admin`)** 贡献代码！本控制台直接面向平台最高权限超级管理员，请严格遵守以下安全边界与工程规范。

---

## 1. 架构与安全边界

1. **双端口 API 协同**：
   - 超管专属治理接口（`/stats`、`/account/*`、`/user/*`、`/oobe/*`、`/config/*`）统一走 **Admin API (`:27043`)**，在生产环境通过 `admin.miniclassisland.com/api` 反向代理访问。
   - 登录认证（`/user/auth`、`/user/2fa/*`）与跨站 SSO 兑换码生成（`/token/exchange`）走 **Management API (`:27042`)**。
2. **跨站跳转安全**：
   - 从超管后台跳转至 `dash.miniclassisland.com` 编辑特定租户时，必须调用 `/token/exchange` 获取一次性短效 `code`，严禁在 URL 中拼接明文 Bearer Token。
3. **纯静态导出模式**：
   - 保持 `next.config` 的静态导出兼容性（构建产物位于 `out/`），确保 Nginx 可直接托管。
4. **敏感信息防护**：
   - 严禁提交 `.env`、`.env.local`、`.vscode/`、`.idea/`、运行日志（`*.log`）或任何证书密钥文件。

---

## 2. 提交前必跑质量门禁

在 `admin/` 目录下执行以下检查并确保全部通过：

```bash
# 1. TypeScript 静态类型检查
npx tsc --noEmit

# 2. ESLint 代码规范检查
npm run lint

# 3. 生产静态站点构建验证
npm run build
```

---

## 3. 强制提交签名 (`git commit -S`)

所有 Commit 必须附带经过 GitHub 验证的 SSH 或 GPG 签名，并采用 Conventional Commits 格式：

```bash
git config gpg.format ssh
git config user.signingkey "~/.ssh/id_ed25519.pub"
git config commit.gpgsign true

git commit -S -m "feat(admin): add real-time quota usage display and SSO jump"
```
