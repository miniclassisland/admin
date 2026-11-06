/* ===== Admin + 嵌套集控全量 API 客户端 ===== */
/* 对接 MINI ClassIsland Admin API (端口 27043，已挂载全部 Management 与 Admin 路由) */

import type {
    PlatformStats,
    UserOut,
    UserUpdateRequest,
    UserRegisterRequest,
    AccountOut,
    AccountCreate,
    AccountCreateRequest,
    AccountUpdateRequest,
    AccountIdUpdate,
    SlugUpdate,
    AccountNameUpdate,
    QuotaOut,
    QuotaSetRequest,
    EmailUpdate,
    UsernameUpdate,
    DisplayNameUpdate,
    PasswordChange,
    TotpEnableResponse,
    TotpConfirmRequest,
    TotpDisableRequest,
    TotpVerifyRequest,
    TotpRecoverRequest,
    PairingCodeOut,
    PairingStatusResponse,
    RegistrationMode,
    PreRegOut,
    PreRegCreate,
    AccessMember,
    AccessRoleUpdate,
    InvitationOut,
    InvitationCreate,
    NotificationPayload,
    BatchRequest,
    ClientBatchRequest,
    StatusResponse,
    MessageResponse,
    TokenResponse,
    ResourceType,
    ClientDeviceOut,
    ClientProfileConfig,
    ConfigUploadItem,
    AuditLogItem,
    ManagementSettings,
    TicketCategory,
    TicketDetail,
    TicketListResponse,
    TicketMessage,
    TicketPriority,
    TicketStatus,
} from "./types";

// ============================================================
// 配置
// ============================================================

const STORAGE_KEY_TOKEN = "miniclassisland_auth_token";
const STORAGE_KEY_ACCOUNT = "miniclassisland_current_account_id";
const STORAGE_KEY_TOKEN_ISSUED_AT = "miniclassisland_token_issued_at";

/** Refresh the 1-hour session token after 50 minutes, keeping a 10-minute margin. */
const TOKEN_REFRESH_AFTER_MS = 50 * 60 * 1000;
const TOKEN_REFRESH_RETRY_MS = 60 * 1000;
const TOKEN_REFRESH_TIMER_MS = 60 * 1000;
const TOKEN_REFRESH_EXEMPT_PATHS = new Set([
    "/token/refresh",
    "/token/deactivate",
    "/token/redeem",
    "/user/auth",
    "/user/apply",
]);
const TOKEN_REFRESH_EXEMPT_PREFIXES = ["/user/2fa/", "/user/availability/"];

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
    return "/api";
}

export function getServerUrl(): string {
    return getAdminUrl();
}

const TRUSTED_DOMAIN_RE = /^(?:[a-z0-9-]+\.)*miniclassisland\.com$/i;

function isTrustedTargetHost(targetHost: string): boolean {
    if (
        targetHost === "localhost" ||
        targetHost === "127.0.0.1" ||
        TRUSTED_DOMAIN_RE.test(targetHost)
    ) {
        return true;
    }
    const baseDomain = (process.env.NEXT_PUBLIC_BASE_DOMAIN || "").trim().toLowerCase();
    if (baseDomain && (targetHost === baseDomain || targetHost.endsWith(`.${baseDomain}`))) {
        return true;
    }
    if (typeof window !== "undefined") {
        const currentHost = window.location.hostname.toLowerCase();
        const rootDomain = currentHost.replace(/^(admin|dash|dashboard|api)\./i, "");
        if (
            rootDomain &&
            rootDomain.includes(".") &&
            (targetHost === rootDomain || targetHost.endsWith(`.${rootDomain}`))
        ) {
            return true;
        }
    }
    return false;
}

/** 主站地址（无权限或返回主面板时跳转，带严格域名白名单校验防止 Open Redirect） */
export function getMainSiteUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL;
    if (envUrl) {
        try {
            const parsed = new URL(envUrl);
            if (isTrustedTargetHost(parsed.hostname.toLowerCase())) {
                return parsed.origin;
            }
        } catch {
            /* ignore invalid URL */
        }
    }
    if (typeof window !== "undefined") {
        const { protocol, hostname, port } = window.location;
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            if (port === "27043") return `${protocol}//${hostname}:27042`;
            if (port === "3001") return `${protocol}//${hostname}:3000`;
            return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
        }
        const baseDomain = hostname.replace(/^admin\./i, "");
        if (/^[a-z0-9.-]+$/i.test(baseDomain)) {
            return `${protocol}//dash.${baseDomain}${port ? `:${port}` : ""}`;
        }
    }
    const configuredBase = (process.env.NEXT_PUBLIC_BASE_DOMAIN || "").trim();
    if (configuredBase && /^[a-z0-9.-]+$/i.test(configuredBase)) {
        return `https://dash.${configuredBase}`;
    }
    return "https://dash.miniclassisland.com";
}

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function setToken(token: string): void {
    if (typeof window === "undefined") return;
    const previous = localStorage.getItem(STORAGE_KEY_TOKEN);
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    // Restoring the same token must not reset its issuance timestamp.
    if (previous !== token) {
        localStorage.setItem(STORAGE_KEY_TOKEN_ISSUED_AT, String(Date.now()));
    }
}

export function clearToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ACCOUNT);
    localStorage.removeItem(STORAGE_KEY_TOKEN_ISSUED_AT);
}

function getTokenIssuedAt(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(STORAGE_KEY_TOKEN_ISSUED_AT);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
}

function isTokenRefreshExempt(path: string): boolean {
    return (
        TOKEN_REFRESH_EXEMPT_PATHS.has(path) ||
        TOKEN_REFRESH_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
    );
}

// ============================================================
// 通用请求
// ============================================================

export class ApiError extends Error {
    status: number;
    code?: string;
    retryAfter?: number;
    detail: unknown;

    constructor(status: number, detail: unknown, retryAfter?: number) {
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
            } else if (Array.isArray(d.detail)) {
                const errors = (d.detail as Array<{ loc?: unknown[]; msg?: string }>).map((err) => {
                    const field = err.loc ? err.loc[err.loc.length - 1] : "";
                    const rawMsg = err.msg || "校验失败";
                    const cleanMsg = rawMsg.replace(/^Value error,\s*/i, "");
                    return field ? `${field}: ${cleanMsg}` : cleanMsg;
                });
                msg = errors.join("; ");
            }
        }

        if (status === 429) {
            if (code === "ERR_IP_BLOCKED" || msg.includes("IP address temporarily blocked")) {
                msg = "当前 IP 因短时间内多次异常请求已被安全机制临时封禁（约 5 分钟），请稍后再试";
            } else if (!msg || msg === "请求失败" || msg.startsWith("{")) {
                msg = "请求过于频繁（HTTP 429），已被安全限流保护拦截，请稍后再试";
            }
        }

        if (msg === "Failed to fetch" || (typeof msg === "string" && msg.includes("Failed to fetch"))) {
            msg = "无法连接至 MINI ClassIsland Admin 服务，请检查网络或服务状态";
        }

        super(msg);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
        this.detail = detail;
    }
}

function emitRateLimited(detail: { message: string; retryAfter: number; code?: string; path?: string }): void {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("miniclassisland:rate-limited", { detail }));
    }
}

function redirectToLoginExpired(): void {
    if (typeof window === "undefined") return;
    clearToken();
    window.location.href = `${getMainSiteUrl()}/login?expired=1`;
}

// ============================================================
// 会话滑动续期
// ============================================================

let activeRequests = 0;
let refreshPromise: Promise<void> | null = null;
let lastRefreshAttemptAt = 0;
let tokenRefreshTimer: number | null = null;

/** Let in-flight requests finish before revoking the old token. */
async function waitForActiveRequests(maxWaitMs = 5000): Promise<void> {
    const startedAt = Date.now();
    while (activeRequests > 0 && Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

type NavigatorWithLocks = Navigator & {
    locks?: {
        request<T>(name: string, callback: () => Promise<T>): Promise<T>;
    };
};

/** Coordinate refreshes across tabs so one tab cannot revoke another's token. */
async function withRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined") {
        const locks = (navigator as NavigatorWithLocks).locks;
        if (locks) {
            return locks.request("miniclassisland-token-refresh", callback);
        }
    }
    return callback();
}

async function refreshSessionToken(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    const current = getToken();
    if (!current) return;

    refreshPromise = withRefreshLock(async () => {
        await waitForActiveRequests();
        const tokenToRefresh = getToken();
        if (!tokenToRefresh) return;
        const issuedAtBefore = getTokenIssuedAt();
        // Another tab may have already refreshed while we waited for the lock.
        if (
            issuedAtBefore > 0 &&
            Date.now() - issuedAtBefore < TOKEN_REFRESH_AFTER_MS
        ) {
            return;
        }
        lastRefreshAttemptAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(`${getAdminUrl()}/token/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tokenToRefresh}` },
                signal: controller.signal,
            });
            if (res.status === 401 || res.status === 403) {
                const latest = getToken();
                if (
                    latest &&
                    latest !== tokenToRefresh &&
                    getTokenIssuedAt() > issuedAtBefore
                ) {
                    return;
                }
                redirectToLoginExpired();
                return;
            }
            if (!res.ok) return;
            const data = (await res.json()) as { token?: string };
            if (data?.token) {
                setToken(data.token);
            }
        } catch {
            /* Network failure: retry on a later request/timer tick. */
        } finally {
            clearTimeout(timeout);
        }
    }).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

async function ensureFreshToken(path: string): Promise<void> {
    if (typeof window === "undefined" || isTokenRefreshExempt(path)) return;
    if (refreshPromise) {
        await refreshPromise;
        return;
    }
    if (!getToken()) return;

    const issuedAt = getTokenIssuedAt();
    const age = issuedAt > 0 ? Date.now() - issuedAt : Number.POSITIVE_INFINITY;
    if (age < TOKEN_REFRESH_AFTER_MS) return;
    if (Date.now() - lastRefreshAttemptAt < TOKEN_REFRESH_RETRY_MS) return;
    await refreshSessionToken();
}

function startTokenRefreshTimer(): void {
    if (typeof window === "undefined" || tokenRefreshTimer !== null) return;
    tokenRefreshTimer = window.setInterval(() => {
        void ensureFreshToken("/__token_timer__");
    }, TOKEN_REFRESH_TIMER_MS);
}

async function request<T>(
    path: string,
    options: RequestInit = {},
    retried = false,
): Promise<T> {
    const base = getAdminUrl();

    await ensureFreshToken(path);

    const tokenVal = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (tokenVal) {
        headers["Authorization"] = `Bearer ${tokenVal}`;
    }
    if (options.body && typeof options.body === "string") {
        headers["Content-Type"] = "application/json";
    }

    let res: Response;
    activeRequests += 1;
    try {
        res = await fetch(`${base}${path}`, { ...options, headers });
    } catch (err: unknown) {
        const errObj = err as { message?: string; name?: string } | null;
        const rawMsg = errObj?.message || String(err);
        if (rawMsg.includes("Failed to fetch") || rawMsg.includes("fetch failed") || errObj?.name === "TypeError") {
            throw new ApiError(0, "无法连接至 MINI ClassIsland Admin 服务，请检查服务是否已启动");
        }
        throw err;
    } finally {
        activeRequests = Math.max(0, activeRequests - 1);
    }

    if (res.status === 401) {
        const latestToken = getToken();
        if (!retried && latestToken && latestToken !== tokenVal) {
            return request<T>(path, options, true);
        }
        redirectToLoginExpired();
        throw new ApiError(res.status, "未授权或登录已过期");
    }

    if (res.status === 403 && path === "/") {
        if (typeof window !== "undefined") {
            clearToken();
            window.location.href = getMainSiteUrl();
        }
        throw new ApiError(res.status, "无超级管理员权限");
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

        if (res.status === 429) {
            const retryHeader = res.headers.get("retry-after");
            const parsedRetry = retryHeader ? parseInt(retryHeader, 10) : NaN;
            const retryAfter = !Number.isNaN(parsedRetry) && parsedRetry > 0
                ? parsedRetry
                : (code === "ERR_IP_BLOCKED" ? 300 : 30);
            const apiErr = new ApiError(429, detail, retryAfter);
            emitRateLimited({
                message: apiErr.message,
                retryAfter,
                code: apiErr.code,
                path,
            });
            throw apiErr;
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
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: "PATCH",
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

function del<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
}

function acctPath(accountId: string): string {
    return `/account/${encodeURIComponent(accountId)}`;
}

// ============================================================
// Token / User Info / 2FA
// ============================================================

export const token = {
    refresh: () => post<TokenResponse>("/token/refresh"),
    verify: () => post<unknown>("/token/verify"),
    deactivate: () => post<MessageResponse>("/token/deactivate"),
    exchange: () => post<{ code: string }>("/token/exchange"),
    redeem: (code: string) => post<TokenResponse>("/token/redeem", { code }),
};

export const userInfo = {
    get: () => get<UserOut>("/user/info"),
    changeEmail: (data: EmailUpdate) => post<unknown>("/user/info/email", data),
    changeUsername: (data: UsernameUpdate) => post<unknown>("/user/info/username", data),
    changeDisplayName: (data: DisplayNameUpdate) => post<unknown>("/user/info/display-name", data),
    changePassword: (data: PasswordChange) => post<unknown>("/user/info/password/change", data),
};

export const twoFA = {
    enable: (reset = false) => post<TotpEnableResponse>(`/user/2fa/totp/enable${reset ? "?reset=true" : ""}`),
    confirm: (data: TotpConfirmRequest) => post<unknown>("/user/2fa/totp/confirm", data),
    disable: (data: TotpDisableRequest) => post<unknown>("/user/2fa/totp/disable", data),
    verify: (data: TotpVerifyRequest) => post<TokenResponse>("/user/2fa/totp/verify", data),
    recover: (data: TotpRecoverRequest) => post<TokenResponse>("/user/2fa/totp/recover", data),
};

// ============================================================
// Accounts (嵌套租户管理 + 配额)
// ============================================================

export const accounts = {
    list: () => get<AccountOut[]>("/account"),
    search: (q: string) => get<AccountOut[]>(`/account/search?q=${encodeURIComponent(q)}`),
    apply: (data: AccountCreate) => post<AccountOut>("/account/create", data),
    delete: (accountId: string) => del<unknown>(`/account/${encodeURIComponent(accountId)}`),
    info: (accountId: string) => get<AccountOut>(`/account/${encodeURIComponent(accountId)}`),
    updateInfo: (accountId: string, data: AccountUpdateRequest) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info`, data),
    changeId: (accountId: string, data: AccountIdUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/id`, data),
    changeSlug: (accountId: string, data: SlugUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/slug`, data),
    changeName: (accountId: string, data: AccountNameUpdate) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/name`, data),
    regenerateApiKey: (accountId: string) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}/info/regenerate-api-key`),
    downloadPreset: (accountId: string, classIdentity = "") =>
        get<ManagementSettings>(`${acctPath(accountId)}/ManagementPreset.json${classIdentity ? `?class_identity=${encodeURIComponent(classIdentity)}` : ""}`),
    getQuotas: (accountId: string) =>
        get<QuotaOut[]>(`${acctPath(accountId)}/quota`),
    setQuota: (accountId: string, data: QuotaSetRequest) =>
        post<QuotaOut>(`${acctPath(accountId)}/quota`, data),
};

// ============================================================
// Pairing & Pre-Registration
// ============================================================

export const pairing = {
    getStatus: (accountId: string) =>
        get<PairingStatusResponse>(`${acctPath(accountId)}/pairing/status`),
    setMode: (accountId: string, mode: RegistrationMode) =>
        post<{ status: string; registration_mode: RegistrationMode }>(`${acctPath(accountId)}/pairing/mode`, { mode }),
    listCodes: (accountId: string) =>
        get<PairingCodeOut[]>(`${acctPath(accountId)}/pairing/list`),
    search: (accountId: string, q?: string) =>
        get<PairingCodeOut[]>(`${acctPath(accountId)}/pairing/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    approve: (accountId: string, pairingId: string, presetProfile?: ClientProfileConfig) =>
        post<unknown>(`${acctPath(accountId)}/pairing/${encodeURIComponent(pairingId)}/approve`, presetProfile ? { preset_profile: presetProfile } : {}),
    reject: (accountId: string, pairingId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/${encodeURIComponent(pairingId)}/reject`),
    enable: (accountId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/enable`),
    disable: (accountId: string) =>
        post<unknown>(`${acctPath(accountId)}/pairing/disable`),
};

export const preRegistration = {
    list: (accountId: string) =>
        get<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/list`),
    search: (accountId: string, q?: string) =>
        get<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    get: (accountId: string, preRegId: string) =>
        get<PreRegOut>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}`),
    create: (accountId: string, data: PreRegCreate) =>
        post<PreRegOut>(`${acctPath(accountId)}/pre-registration/create`, data),
    batchCreate: (accountId: string, items: PreRegCreate[]) =>
        post<PreRegOut[]>(`${acctPath(accountId)}/pre-registration/batch-create`, { items }),
    delete: (accountId: string, preRegId: string) =>
        del<void>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}`),
    rename: (accountId: string, preRegId: string, body: { label?: string; class_identity?: string; mac_address?: string }) =>
        post<PreRegOut>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/rename`, body),
    enable: (accountId: string, preRegId: string) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/enable`),
    disable: (accountId: string, preRegId: string) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/disable`),
    config: (accountId: string, preRegId: string, body: ClientProfileConfig) =>
        post<unknown>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/config`, body),
    downloadPreset: (accountId: string, preRegId: string) =>
        get<ManagementSettings>(`${acctPath(accountId)}/pre-registration/${encodeURIComponent(preRegId)}/ManagementPreset.json`),
};

// ============================================================
// Access Control & Invitations
// ============================================================

export const access = {
    list: (accountId: string) =>
        get<AccessMember[]>(`${acctPath(accountId)}/access/list`),
    search: (accountId: string, q?: string) =>
        get<AccessMember[]>(`${acctPath(accountId)}/access/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    get: (accountId: string, userId: string) =>
        get<AccessMember>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`),
    update: (accountId: string, userId: string, data: AccessRoleUpdate) =>
        post<AccessMember>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`, data),
    rename: (accountId: string, userId: string, body: { display_name?: string; name?: string }) =>
        post<unknown>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}/rename`, body),
    delete: (accountId: string, userId: string) =>
        del<void>(`${acctPath(accountId)}/access/${encodeURIComponent(userId)}`),
};

export const invitations = {
    list: (accountId: string) =>
        get<InvitationOut[]>(`${acctPath(accountId)}/invitation/list`),
    search: (accountId: string, q?: string) =>
        get<InvitationOut[]>(`${acctPath(accountId)}/invitation/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    get: (accountId: string, invitationId: string) =>
        get<InvitationOut>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}`),
    create: (accountId: string, data?: InvitationCreate) =>
        post<InvitationOut>(`${acctPath(accountId)}/invitation/create`, data || {}),
    accept: (code: string) =>
        post<{ status: string; account_id: string; role_in_account: string }>(`/account/invitation/accept`, { code }),
    rename: (accountId: string, invitationId: string, body: { role_in_account?: string; is_active?: boolean }) =>
        post<unknown>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}/rename`, body),
    delete: (accountId: string, invitationId: string) =>
        del<void>(`${acctPath(accountId)}/invitation/${encodeURIComponent(invitationId)}`),
};

// ============================================================
// Data（7 大集控资源 CRUD）& Credentials Helper
// ============================================================

export const data = {
    create: (accountId: string, type: ResourceType, name: string) =>
        get<StatusResponse>(`${acctPath(accountId)}/${type}/create?name=${encodeURIComponent(name)}`),
    list: (accountId: string, type: ResourceType) =>
        get<string[]>(`${acctPath(accountId)}/${type}/list`),
    getToken: (accountId: string, type: ResourceType, name: string) =>
        get<{ token: string; url: string }>(`${acctPath(accountId)}/${type}/token?name=${encodeURIComponent(name)}`),
    deleteData: (accountId: string, type: ResourceType, name: string) =>
        del<StatusResponse>(`${acctPath(accountId)}/${type}/delete?name=${encodeURIComponent(name)}`),
    write: (accountId: string, type: ResourceType, name: string, payload: unknown) =>
        post<StatusResponse>(`${acctPath(accountId)}/${type}/write?name=${encodeURIComponent(name)}`, payload),
    patch: (accountId: string, type: ResourceType, name: string, payload: unknown) =>
        patch<StatusResponse>(`${acctPath(accountId)}/${type}/update?name=${encodeURIComponent(name)}`, payload),
    read: (accountId: string, type: ResourceType, name: string) =>
        get<unknown>(`${acctPath(accountId)}/${type}/${encodeURIComponent(name)}`),
    listHistory: (accountId: string, type: ResourceType, name: string) =>
        get<import("./types").ResourceHistoryItem[]>(`${acctPath(accountId)}/${type}/history?name=${encodeURIComponent(name)}`),
    readHistoryVersion: (accountId: string, type: ResourceType, name: string, version: number) =>
        get<import("./types").ResourceHistoryVersionOut>(`${acctPath(accountId)}/${type}/history/${version}?name=${encodeURIComponent(name)}`),
    batch: (accountId: string, ops: BatchRequest) =>
        post<unknown>(`${acctPath(accountId)}/batch`, { ...ops, target_account_id: accountId }),
};

export const credentials = {
    encode: (accountId: string, password: string) =>
        post<{ credential: string }>(`${acctPath(accountId)}/credentials/encode`, { password }),
};

// ============================================================
// Clients & Audit Logs
// ============================================================

export const clients = {
    list: (accountId: string) =>
        get<ClientDeviceOut[]>(`${acctPath(accountId)}/client/list`),
    search: (accountId: string, q?: string) =>
        get<ClientDeviceOut[]>(`${acctPath(accountId)}/client/search${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    details: (accountId: string, clientId: string) =>
        get<ClientDeviceOut>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}`),
    delete: (accountId: string, clientId: string) =>
        del<void>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}`),
    rename: (accountId: string, clientId: string, body: { display_name?: string; client_id?: string }) =>
        post<unknown>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/rename`, body),
    status: (accountId: string, clientId: string) =>
        get<{ uid: string; status: string; is_disabled: boolean }>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/status`),
    disconnect: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/disconnect`),
    disable: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/disable`),
    enable: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/enable`),
    getProfileConfig: (accountId: string, clientId: string) =>
        get<{ client_uid: string; profile_config: ClientProfileConfig; has_custom_profile: boolean }>(
            `${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config`
        ),
    config: (accountId: string, clientId: string, body: ClientProfileConfig) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config`, body),
    batch: (accountId: string, req: ClientBatchRequest) =>
        post<{ status: string; results: Array<{ uid: string; status: string }> }>(`${acctPath(accountId)}/client/batch`, req),
    restart: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/restart`),
    forceSync: (accountId: string, clientId: string) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/update-data`),
    sendNotification: (accountId: string, clientId: string, payload: NotificationPayload) =>
        post<StatusResponse>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/send-notification`, payload),
    broadcastNotification: (accountId: string, payload: NotificationPayload, clientUids?: string[]) =>
        post<{ status: string; sent_count: number; total_targets: number }>(
            `${acctPath(accountId)}/client/broadcast/send-notification`,
            { ...payload, client_uids: clientUids || null }
        ),
    getConfig: (accountId: string, clientId: string, configType: number) =>
        get<{ status: string; request_guid: string; config_type: number; config_type_name: string }>(
            `${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/command/get-config?config_type=${configType}`
        ),
    listConfigUploads: (accountId: string, clientId: string) =>
        get<ConfigUploadItem[]>(`${acctPath(accountId)}/client/${encodeURIComponent(clientId)}/config-uploads`),
    getConfigUploadDetail: (accountId: string, requestGuid: string) =>
        get<ConfigUploadItem>(`${acctPath(accountId)}/config-upload/${encodeURIComponent(requestGuid)}`),
};

export const audit = {
    list: (accountId: string, params?: { client_uid?: string; event_type?: number; limit?: number; offset?: number }) => {
        const searchParams = new URLSearchParams();
        if (params?.client_uid) searchParams.set("client_uid", params.client_uid);
        if (params?.event_type !== undefined) searchParams.set("event_type", String(params.event_type));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
        if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
        const qs = searchParams.toString();
        return get<AuditLogItem[]>(`${acctPath(accountId)}/audit/list${qs ? `?${qs}` : ""}`);
    },
    clear: (accountId: string, clientUid?: string) =>
        del<{ status: string }>(`${acctPath(accountId)}/audit/clear${clientUid ? `?client_uid=${encodeURIComponent(clientUid)}` : ""}`),
};

export const bulk = {
    execute: (ops: BatchRequest, accountId?: string) =>
        post<unknown>(
            accountId ? `${acctPath(accountId)}/batch` : "/bulk",
            accountId ? { ...ops, target_account_id: accountId } : ops
        ),
};

// ============================================================
// Admin API
// ============================================================

export const adminApi = {
    probe: () =>
        get<{ status: string; message: string }>("/"),

    getStats: () =>
        get<PlatformStats>("/stats"),

    // ---- 用户管理 ----
    listUsers: (offset = 0, limit = 50) =>
        get<UserOut[]>(`/user/list?offset=${offset}&limit=${limit}`),

    searchUsers: (q: string) =>
        get<UserOut[]>(`/user/search?q=${encodeURIComponent(q)}`),

    createUser: (data: UserRegisterRequest) =>
        post<UserOut>("/user/create", data),

    getUser: (userId: string) =>
        get<UserOut>(`/user/${encodeURIComponent(userId)}`),

    updateUser: (userId: string, data: UserUpdateRequest) =>
        post<UserOut>(`/user/${encodeURIComponent(userId)}`, data),

    deleteUser: (userId: string) =>
        del<{ status: string }>(`/user/${encodeURIComponent(userId)}`),

    renameUser: (userId: string, data: { name: string }) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/rename`, data),

    resetPassword: (userId: string, data: { new_password: string }) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/password/reset`, data),

    changePassword: (userId: string, data: PasswordChange) =>
        post<{ status: string }>(`/user/${encodeURIComponent(userId)}/password/change`, data),

    // ---- 用户审核 ----
    listPendingUsers: () =>
        get<UserOut[]>("/user/pending/list"),

    approveUser: (userId: string) =>
        post<UserOut>(`/user/pending/approve/${encodeURIComponent(userId)}`),

    rejectUser: (userId: string) =>
        post<{ status: string }>(`/user/pending/reject/${encodeURIComponent(userId)}`),

    // ---- 账户与配额管理 ----
    listAccounts: () =>
        get<AccountOut[]>("/account"),

    searchAccounts: (q: string) =>
        get<AccountOut[]>(`/account/search?q=${encodeURIComponent(q)}`),

    createAccount: (data: AccountCreateRequest) =>
        post<AccountOut>("/account/create", data),

    updateAccount: (accountId: string, data: AccountUpdateRequest) =>
        post<AccountOut>(`/account/${encodeURIComponent(accountId)}`, data),

    deleteAccount: (accountId: string) =>
        del<{ status: string }>(`/account/${encodeURIComponent(accountId)}`),

    getAccountQuotas: (accountId: string) =>
        get<QuotaOut[]>(`/account/${encodeURIComponent(accountId)}/quota`),

    setAccountQuota: (accountId: string, data: QuotaSetRequest) =>
        post<QuotaOut>(`/account/${encodeURIComponent(accountId)}/quota`, data),

    // ---- 系统设置 ----
    getSettings: () =>
        get<Record<string, unknown>>("/settings"),

    updateSettings: (data: Record<string, unknown>) =>
        post<unknown>("/settings", data),

    refreshCommunityCode: () =>
        post<{ code: string }>("/community/refresh_code"),

    // ---- 2FA 管理 ----
    enable2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/enable`),

    disable2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/disable`),

    reset2FA: (userId: string) =>
        post<unknown>(`/user/${encodeURIComponent(userId)}/2fa/reset`),

    // ---- 工单管理 ----
    listTickets: (params?: {
        offset?: number;
        limit?: number;
        status?: TicketStatus;
        priority?: TicketPriority;
        category?: TicketCategory;
        q?: string;
        unreadOnly?: boolean;
    }) => {
        const searchParams = new URLSearchParams();
        if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
        if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
        if (params?.status) searchParams.set("status", params.status);
        if (params?.priority) searchParams.set("priority", params.priority);
        if (params?.category) searchParams.set("category", params.category);
        if (params?.q?.trim()) searchParams.set("q", params.q.trim());
        if (params?.unreadOnly) searchParams.set("unread_only", "true");
        const qs = searchParams.toString();
        return get<TicketListResponse>(`/ticket/list${qs ? `?${qs}` : ""}`);
    },

    getTicket: (ticketId: string) =>
        get<TicketDetail>(`/ticket/${encodeURIComponent(ticketId)}`),

    replyTicket: (ticketId: string, content: string) =>
        post<TicketMessage>(`/ticket/${encodeURIComponent(ticketId)}/reply`, { content }),

    updateTicket: (
        ticketId: string,
        data: { status?: TicketStatus; priority?: TicketPriority },
    ) =>
        post<TicketDetail>(`/ticket/${encodeURIComponent(ticketId)}/status`, data),

    getTicketUnreadCount: () =>
        get<{ count: number }>("/ticket/unread-count"),

    // ---- 系统信息 ----
    getVersion: () => get<{ version: string }>("/version"),

    // ---- 批量操作 ----
    bulk: (ops: unknown) =>
        post<unknown>("/bulk", ops),
};

startTokenRefreshTimer();
