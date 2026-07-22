/* ===== Admin API 客户端 ===== */
/* 仅对接 Admin API (端口 27043)，复用 MINI ClassIsland Web 的 Management API Token */

import type {
    UserOut, UserUpdateRequest, UserRegisterRequest,
    AccountOut, PasswordChange,
} from "./types";

// ============================================================
// 配置
// ============================================================

const STORAGE_KEY_TOKEN = "miniclassisland_auth_token";

/** Admin API 基础地址 */
export function getAdminUrl(): string {
    const url = process.env.NEXT_PUBLIC_MINICLASSISLAND_ADMIN_ENDPOINT || "";
    return url.replace(/\/+$/, "");
}

/** 主站地址（无权限时回退） */
export function getMainSiteUrl(): string {
    return process.env.NEXT_PUBLIC_MAIN_SITE_URL || "/";
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
    detail: unknown;
    constructor(status: number, detail: unknown) {
        let msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "未知的服务器回答，请联系管理员";
        }
        super(msg);
        this.status = status;
        this.detail = detail;
    }
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const base = getAdminUrl();
    if (!base) throw new Error("未配置 Admin API 地址");

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
            throw new ApiError(0, "未知的服务器回答，请联系管理员");
        }
        throw err;
    }

    if (res.status === 503) {
        if (typeof window !== "undefined") {
            window.location.href = "https://admin.localminiclassisland.miniopensource.com/oobe";
            return new Promise(() => {});
        }
    }

    if (res.status === 401 || res.status === 403) {
        // 无权限，跳转回主站
        if (typeof window !== "undefined") {
            clearToken();
            window.location.href = getMainSiteUrl();
        }
        throw new ApiError(res.status, "未授权或权限不足");
    }

    if (!res.ok) {
        let detail: unknown;
        try { detail = await res.json(); } catch { detail = await res.text(); }

        let msg = "请求失败";
        if (detail && typeof detail === "object") {
            const d = detail as Record<string, unknown>;
            if (Array.isArray(d.detail)) {
                // 自动提取 Pydantic/FastAPI 的校验错误列表
                const errors = (d.detail as Array<{ loc?: unknown[]; msg?: string }>).map((err) => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : "";
                    const rawMsg = err.msg || "校验失败";
                    // 去除 Pydantic 错误中多余的前缀
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

        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "未知的服务器回答，请联系管理员";
        }

        throw new ApiError(res.status, msg);
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
        get<{ message: string }>("/"),

    // ---- 用户管理 ----

    /** 列出所有用户（分页） */
    listUsers: (offset = 0, limit = 20) =>
        get<UserOut[]>(`/user/list?offset=${offset}&limit=${limit}`),

    /** 搜索用户 */
    searchUsers: (q: string) =>
        get<UserOut[]>(`/user/search?q=${encodeURIComponent(q)}`),

    /** 直接创建用户（跳过审核） */
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
        del<unknown>(`/user/${encodeURIComponent(userId)}`),

    /** 重命名用户 */
    renameUser: (userId: string, data: { name: string }) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/rename`, data),

    /** 重置用户密码（无需旧密码） */
    resetPassword: (userId: string, data: { new_password: string }) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/password/reset`, data),

    /** 修改用户密码（需旧密码） */
    changePassword: (userId: string, data: PasswordChange) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/password/change`, data),

    // ---- 用户审核 ----

    /** 待审核用户列表 */
    listPendingUsers: (offset = 0, limit = 50) =>
        get<UserOut[]>(`/user/pending/list?offset=${offset}&limit=${limit}`),

    /** 批准用户 */
    approveUser: (userId: string) =>
        post<unknown>(`/user/pending/approve/${encodeURIComponent(userId)}`),

    /** 拒绝用户 */
    rejectUser: (userId: string) =>
        post<unknown>(`/user/pending/reject/${encodeURIComponent(userId)}`),

    // ---- 账户管理 ----

    /** 列出所有账户 */
    listAccounts: () =>
        get<AccountOut[]>("/account"),

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
