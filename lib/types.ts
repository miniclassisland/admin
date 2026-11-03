/* ===== TypeScript 类型定义 ===== */
/* MINI ClassIsland 超级管理平台类型，对应后端 Admin API Schema */

// ============================================================
// 全局平台统计
// ============================================================

export interface PlatformStats {
    total_accounts: number;
    active_accounts: number;
    total_users: number;
    pending_users: number;
    total_clients: number;
    online_clients: number;
    total_audit_logs: number;
}

// ============================================================
// 用户
// ============================================================

export interface UserOut {
    id: string;
    username: string;
    email: string;
    display_name: string;
    role_code: string;
    is_active: boolean;
    totp_enabled?: boolean;
    can_create_account?: boolean;
    created_at: string;
}

export interface UserUpdateRequest {
    username?: string | null;
    display_name?: string | null;
    role_code?: string | null;
    is_active?: boolean | null;
    can_create_account?: boolean | null;
}

export interface UserRegisterRequest {
    email: string;
    password: string;
    username?: string;
    display_name?: string;
    role_code?: string;
    can_create_account?: boolean;
}

export interface PasswordChange {
    old_password: string;
    new_password: string;
}

// ============================================================
// 账户与配额
// ============================================================

export type RegistrationMode = "open" | "pairing" | "pre_reg";

export interface AccountOut {
    id: string;
    name: string;
    slug: string;
    api_key: string;
    is_active: boolean;
    registration_mode?: RegistrationMode;
    created_at: string;
}

export interface AccountCreateRequest {
    name: string;
    slug?: string;
    owner_user_id?: string;
}

export interface AccountUpdateRequest {
    name?: string;
    slug?: string;
    is_active?: boolean;
    registration_mode?: RegistrationMode;
}

export interface QuotaOut {
    id: string;
    account_id: string;
    quota_key: string;
    max_value: number;
    current_value: number;
}

export interface QuotaSetRequest {
    quota_key: string;
    max_value: number;
}

export const QUOTA_META: Record<string, { label: string; hint: string; type: "number" | "boolean"; defaultMax: number }> = {
    max_clients: {
        label: "最大接入设备数",
        hint: "该账户允许注册/接入的最大终端数量",
        type: "number",
        defaultMax: 100,
    },
    max_bandwidth_mb: {
        label: "月度流量配额 (MB)",
        hint: "该账户允许的最大配置与资源分发流量",
        type: "number",
        defaultMax: 10240,
    },
    "feature.ota": {
        label: "OTA 策略与组件分发",
        hint: "允许该账户使用远程组件与策略分发能力 (1=开启, 0=关闭)",
        type: "boolean",
        defaultMax: 1,
    },
    "feature.audit": {
        label: "终端安全审计日志",
        hint: "允许该账户收集并检索客户端事件审计日志 (1=开启, 0=关闭)",
        type: "boolean",
        defaultMax: 1,
    },
};

// ============================================================
// 系统设置
// ============================================================

export const SETTINGS_ALLOWED_KEYS = [
    "registration_open",
    "require_approval",
    "max_accounts_per_user",
    "default_role",
    "motd",
] as const;

export interface SettingsUpdate {
    items: Record<string, string>;
}

// ============================================================
// 系统角色
// ============================================================

export const SYSTEM_ROLES = {
    BANNED: "banned",
    PENDING: "pending",
    NORMAL: "normal",
    ADMIN: "admin",
    SUPERADMIN: "superadmin",
} as const;

export const ROLE_LABELS: Record<string, string> = {
    banned: "已封禁",
    pending: "待审核",
    normal: "普通用户",
    admin: "管理员",
    superadmin: "超级管理员",
};

// ============================================================
// 通用响应
// ============================================================

export interface StatusResponse {
    status: string;
    message: string;
}

export interface MessageResponse {
    status: string;
    message: string;
}

// ============================================================
// 设置项标签
// ============================================================

export const SETTINGS_LABELS: Record<string, { label: string; hint: string; type: "boolean" | "number" | "string" }> = {
    registration_open: {
        label: "开放注册",
        hint: "允许新用户自助注册平台账号",
        type: "boolean",
    },
    require_approval: {
        label: "注册审核",
        hint: "新注册用户需要超级管理员审核批准后才能激活",
        type: "boolean",
    },
    max_accounts_per_user: {
        label: "每用户最大账户数",
        hint: "单个用户可创建的最大多租户账户数量",
        type: "number",
    },
    default_role: {
        label: "默认角色",
        hint: "新注册用户的默认系统角色代码 (normal / admin)",
        type: "string",
    },
    motd: {
        label: "全局公告信息",
        hint: "显示给所有登录用户的系统通知公告",
        type: "string",
    },
};
