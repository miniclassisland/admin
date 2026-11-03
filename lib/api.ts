/* ===== Admin API 客户端 ===== */
/* 对接 MINI ClassIsland Admin API (端口 27043)，复用 Web 主面板的 Bearer Token */

import type {
    PlatformStats,
    UserOut,
    UserUpdateRequest,
    UserRegisterRequest,
    AccountOut,
    AccountCreateRequest,
    AccountUpdateRequest,
    QuotaOut,
    QuotaSetRequest,
    PasswordChange,
} from "./types";

// ============================================================
// 配置
// ============================================================

const STORAGE_KEY_TOKEN = "miniclassisland_auth_token";

/** Admin API 基础地址 */
export function getAdminUrl(): string {
    const url = process.env.NEXT_PUBLIC_MINICLASSISLAND_ADMIN_ENDPOINT;
    if (url) return url.replace(/\/+$/, "");
    if (typeof window !== "undefined") {
        const { protocol, hostname, port } = window.location;
        if (port === "3000" || port === "3001") {
            return `${protocol}//${hostname}:27043`;
        }
    }
    return "";
}

/** 主站地址（无权限或返回主面板时跳转） */
export function getMainSiteUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL;
    if (envUrl) return envUrl;
    if (typeof window !== "undefined") {
        const { protocol, hostname, port, host } = window.location;
        if (port === "27043") {
            return `${protocol}//${hostname}:27042`;
        }
        if (hostname.startsWith("admin.")) {
            return `${protocol}//${host.replace(/^admin\./, "")}`;
        }
    }
    return "/";
}

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setToken(token: string): void {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function clearToken(): void {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
}

// ============================================================
// 通用请求
// ============================================================

export class ApiError extends Error {
    status: number;
    code?: string;
    detail: unknown;

    constructor(status: number, detail: unknown) {
        let msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        let code: string | undefined;

        if (detail && typeof detail === "object") {
            const d = detail as Record<string, unknown>;
            if (typeof d.code === "string") {
                code = d.code;
            }
            if (typeof d.msg === "string") {
                msg = d.msg;
            } else if (typeof d.detail === "string") {
                msg = d.detail;
            }
        }

        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "无法连接至 MINI ClassIsland Admin 服务，请检查网络或服务状态";
        }

        super(msg);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const base = getAdminUrl();

    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (options.body && typeof options.body === "string") {
        headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
        res = await fetch(`${base}${path}`, { ...options, headers });
    } catch (err: unknown) {
        const errObj = err as { message?: string; name?: string } | null;
        const rawMsg = errObj?.message || String(err);
        if (rawMsg.includes("Failed to fetch") || rawMsg.includes("fetch failed") || errObj?.name === "TypeError") {
            throw new ApiError(0, "无法连接至 MINI ClassIsland Admin 服务，请检查服务是否已启动");
        }
        throw err;
    }

    if (res.status === 401 || res.status === 403) {
        if (typeof window !== "undefined") {
            clearToken();
            window.location.href = getMainSiteUrl();
        }
        throw new ApiError(res.status, "未授权或无超级管理员权限");
    }

    if (!res.ok) {
        let detail: unknown;
        try { detail = await res.json(); } catch { detail = await res.text(); }

        let code: string | undefined;
        let msg = "请求失败";
        if (detail && typeof detail === "object") {
            const d = detail as Record<string, unknown>;
            if (typeof d.code === "string") {
                code = d.code;
            }
            if (Array.isArray(d.detail)) {
                const errors = (d.detail as Array<{ loc?: unknown[]; msg?: string }>).map((err) => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : "";
                    const rawMsg = err.msg || "校验失败";
                    const cleanMsg = rawMsg.replace(/^Value error,\s*/i, "");
                    return field ? `${field}: ${cleanMsg}` : cleanMsg;
                });
                msg = errors.join("; ");
            } else if (typeof d.detail === "string") {
                msg = d.detail;
            } else if (typeof d.msg === "string") {
                msg = d.msg;
            } else if (typeof d.message === "string") {
                msg = d.message;
            } else {
                msg = JSON.stringify(detail);
            }
        } else if (typeof detail === "string") {
            msg = detail;
        }

        const isOobe = res.status === 503 || code === "ERR_SYSTEM_OOBE" || msg.includes("System not initialized");
        if (isOobe) {
            if (typeof window !== "undefined") {
                const pathName = window.location.pathname;
                const isOobePage = pathName === "/oobe" || pathName.startsWith("/oobe");
                const isOobeApi = path.startsWith("/api/oobe") || path.includes("/oobe");
                if (!isOobePage && !isOobeApi) {
                    window.location.href = "/oobe";
                    return new Promise(() => {});
                }
            }
        }

        throw new ApiError(res.status, detail);
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
}

function get<T>(path: string): Promise<T> {
    return request<T>(path, { method: "GET" });
}

function post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
    });
}

function del<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
}

// ============================================================
// Admin API
// ============================================================

export const adminApi = {
    /** 状态检测 (也用于权限探测) */
    probe: () =>
        get<{ status: string; message: string }>("/"),

    /** 获取平台全局统计指标 */
    getStats: () =>
        get<PlatformStats>("/stats"),

    // ---- 用户管理 ----

    /** 列出所有用户（分页） */
    listUsers: (offset = 0, limit = 50) =>
        get<UserOut[]>(`/user/list?offset=${offset}&limit=${limit}`),

    /** 搜索用户 */
    searchUsers: (q: string) =>
        get<UserOut[]>(`/user/search?q=${encodeURIComponent(q)}`),

    /** 直接创建用户（跳过审核，自动创建默认账户） */
    createUser: (data: UserRegisterRequest) =>
        post<UserOut>("/user/create", data),

    /** 查询单个用户 */
    getUser: (userId: string) =>
        get<UserOut>(`/user/${encodeURIComponent(userId)}`),

    /** 更新用户 */
    updateUser: (userId: string, data: UserUpdateRequest) =>
        post<UserOut>(`/user/${encodeURIComponent(userId)}`, data),

    /** 删除用户 */
    deleteUser: (userId: string) =>
        del<{ status: string }>(`/user/${encodeURIComponent(userId)}`),

    /** 重命名用户 */
    renameUser: (userId: string, data: { name: string }) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/rename`, data),

    /** 重置用户密码（无需旧密码） */
    resetPassword: (userId: string, data: { new_password: string }) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/password/reset`, data),

    /** 修改用户密码（需旧密码） */
    changePassword: (userId: string, data: PasswordChange) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/password/change`, data),

    // ---- 用户审核 ----

    /** 待审核用户列表 */
    listPendingUsers: () =>
        get<UserOut[]>("/user/pending/list"),

    /** 批准用户 */
    approveUser: (userId: string) =>
        post<UserOut>(`/user/pending/approve/${encodeURIComponent(userId)}`),

    /** 拒绝用户 */
    rejectUser: (userId: string) =>
        post<{ status: string }>(`/user/pending/reject/${encodeURIComponent(userId)}`),

    // ---- 账户与配额管理 ----

    /** 列出所有账户 */
    listAccounts: () =>
        get<AccountOut[]>("/account"),

    /** 搜索账户 */
    searchAccounts: (q: string) =>
        get<AccountOut[]>(`/account/search?q=${encodeURIComponent(q)}`),

    /** 创建新账户 */
    createAccount: (data: AccountCreateRequest) =>
        post<AccountOut>("/account/create", data),

    /** 更新账户信息 */
    updateAccount: (accountId: string, data: AccountUpdateRequest) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}`, data),

    /** 删除账户 */
    deleteAccount: (accountId: string) =>
        del<{ status: string }>(`/account/${encodeURIComponent(accountId)}`),

    /** 获取账户配额 */
    getAccountQuotas: (accountId: string) =>
        get<QuotaOut[]>(`/account/${encodeURIComponent(accountId)}/quota`),

    /** 设置账户配额 */
    setAccountQuota: (accountId: string, data: QuotaSetRequest) =>
        post<QuotaOut>(`/account/${encodeURIComponent(accountId)}/quota`, data),

    // ---- 系统设置 ----

    /** 获取系统设置 */
    getSettings: () =>
        get<Record<string, unknown>>("/settings"),

    /** 修改系统设置 */
    updateSettings: (data: Record<string, unknown>) =>
        post<unknown>("/settings", data),

    // ---- 2FA 管理 ----

    /** 为用户启用 TOTP */
    enable2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/enable`),

    /** 禁用用户 TOTP */
    disable2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/disable`),

    /** 重置用户 TOTP */
    reset2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/reset`),

    // ---- 批量操作 ----

    /** 批量操作 */
    bulk: (ops: unknown) =>
        post<unknown>("/bulk", ops),
};
