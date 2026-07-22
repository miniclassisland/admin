"use client";

/**
 * Admin 认证上下文。
 *
 * 不含登录/注册流程 — token 由 /auth 页面从 URL 参数注入。
 * 启动时探测 Admin API `/` 端点验证超管权限，
 * 无权限则跳转回主站。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { adminApi, getToken, clearToken, getMainSiteUrl } from "./api";

interface AuthState {
    /** 是否已认证且为超管 */
    isAuthenticated: boolean;
    /** 当前 token */
    token: string | null;
    /** 正在加载（探测权限中） */
    loading: boolean;
    /** 登出（清 token 并跳回主站） */
    logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    // 初始化：从 localStorage 读取 token 并探测权限
    useEffect(() => {
        // 如果是 /auth 或 /oobe 页面，直接让出控制权，由该页面完成 token 写入与刷新跳转或初始化
        if (typeof window !== "undefined" && (
            window.location.pathname === "/auth" || window.location.pathname === "/auth/" ||
            window.location.pathname === "/oobe" || window.location.pathname === "/oobe/"
        )) {
            setTimeout(() => {
                setLoading(false);
                setInitialized(true);
            }, 0);
            return;
        }

        const stored = getToken();
        if (stored) {
            setTimeout(() => setTokenState(stored), 0);
        }

        console.log("Probing admin API...");
        adminApi.probe()
            .then(() => {
                // 权限验证通过
                console.log("Probe success");
                setLoading(false);
                setInitialized(true);
            })
            .catch((err: unknown) => {
                console.error("Probe failed:", err);
                const errObj = err as { status?: number; code?: string; detail?: { code?: string } } | null;
                const isOobe = errObj?.status === 503 || errObj?.code === "ERR_SYSTEM_OOBE" || errObj?.detail?.code === "ERR_SYSTEM_OOBE";
                if (isOobe) {
                    if (typeof window !== "undefined" && window.location.pathname !== "/oobe" && !window.location.pathname.startsWith("/oobe")) {
                        window.location.href = "/oobe";
                    }
                    return;
                }
                clearToken();
                window.location.href = getMainSiteUrl();
            });
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setTokenState(null);
        window.location.href = getMainSiteUrl();
    }, []);

    const isAuthenticated = !!token && !loading && initialized;

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            token,
            loading,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
