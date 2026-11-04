# MINI ClassIsland Admin (`miniclassisland-admin`)

> **MINI ClassIsland** 超级管理员全局治理控制台（`admin.miniclassisland.com`）  
> 基于 Next.js 16 + React 19 + Fluent UI v9 构建的平台级多租户运营与安全治理中心。

[![Next.js 16.2](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB)](https://react.dev/)
[![Fluent UI v9](https://img.shields.io/badge/Fluent%20UI-v9-0078D4)](https://react.fluentui.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org/)

---

## 1. 概述

**MINI ClassIsland Admin** 是面向平台最高权限超级管理员（`role_code = "superadmin"`）的独立管理前端（通过 Nginx `/api` 反代或直连后端 **Admin API `:27043`**，并结合 **Management API `:27042`** 完成认证与跨站 SSO 签发）。它与普通租户面板在域名、端口与中间件鉴权层完全隔离，提供系统首次启动 OOBE 向导、全平台宏观监控、用户注册审批、租户配额管控以及一键接管租户集控等核心治理能力。

---

## 2. 核心功能模块

| 模块 | 路径 | 功能特性 |
| :--- | :--- | :--- |
| **OOBE 首次安装向导** | `/oobe` | 系统未初始化时自动引导：验证服务端控制台输出的 8 位一次性配对码（含防爆破锁定保护），配置 PostgreSQL、Redis、泛域名根域名及首个超级管理员账号，自动建库建表并写入 `.miniclassisland/config.json`。 |
| **全局监控仪表盘** | `/dashboard` | 基于后端 $O(1)$ 内存指标接口（`/stats`），毫秒级展示全平台租户总数、活跃租户数、注册终端总数、实时在线 gRPC 终端流数量、全平台用户数、待审批用户数及累计安全审计事件量。 |
| **全局租户治理与配额管控** | `/accounts` | 检索、创建、启停或删除任意学校/机构租户；修改租户名称、子域名 `slug` 及准入模式；精细化配置每个租户的资源配额（`max_clients` 最大终端数、`max_grpc_connections` 并发长连接上限、`max_bandwidth_mb` 月度流量配额、`feature.audit` 审计开关等）。 |
| **一键免密接管租户 (`进入集控编辑`)** | `/accounts` | 超管点击任意租户的 **“进入集控编辑”** 按钮时，自动向后端申请绑定当前 IP 的 30 秒一次性 SSO 兑换码（`exchange_code`），安全跳转至 `dash.miniclassisland.com` 并自动切换进入目标租户的集控编辑器。 |
| **全平台用户管理** | `/users` | 查看、搜索全平台用户，修改用户角色（`superadmin` / `admin` / `normal` / `banned`）、启用/封禁账号、授予或收回创建租户权限（`can_create_account`），以及为用户重置密码或解绑异常 2FA。 |
| **注册审批队列** | `/approvals` | 集中审核开启“注册需审批”后新提交的用户注册申请，支持一键批准或驳回。 |
| **系统全局参数设置** | `/settings` | 动态管理平台级运行参数（如开放注册开关、新用户审批开关、单用户最大可创建租户数、全局强制配对开关、平台公告 MOTD 及系统保留字管理）。 |

---

## 3. 快速开始

### 3.1 环境要求

- Node.js `>= 20.0`
- npm `>= 10.0`

### 3.2 环境变量配置

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

| 变量名 | 默认值（生产环境） | 本地开发示例 | 说明 |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_ADMIN_API_BASE` | `/api` | `http://127.0.0.1:27043` | 后端 Admin API (`:27043`) 地址（生产环境由 Nginx `admin.miniclassisland.com/api` 反代） |
| `NEXT_PUBLIC_MGMT_API_BASE` | `https://api.miniclassisland.com` | `http://127.0.0.1:27042` | 后端 Management API (`:27042`) 地址（用于统一登录认证与签发 SSO 兑换码） |
| `NEXT_PUBLIC_WEB_URL` | `https://dash.miniclassisland.com` | `http://127.0.0.1:3000` | 租户集控面板地址（用于“进入集控编辑”跳转） |

### 3.3 本地开发与静态导出构建

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev

# 类型检查与代码检查
npx tsc --noEmit
npm run lint

# 构建生产环境静态导出产物 (输出至 ./out 目录)
npm run build
```

---

## 4. 贡献指南与开源协议

- 提交代码前请阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
- 所有 Git Commit 必须使用 SSH 或 GPG 密钥签名（`git commit -S`）。
- 本项目基于 GPL-3.0 协议开源。
