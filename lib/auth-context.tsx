"use client";

/**
 * Admin 认证上下文。
 *
 * 启动时探测 Admin API `/` 端点验证超管权限，并拉取当前登录的超级管理员用户信息 (`userInfo.get()`)。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { adminApi, userInfo, getToken, clearToken, getMainSiteUrl } from "./api";
import type { UserOut } from "./types";

interface AuthState {
    /** 是否已认证且为超管 */
    isAuthenticated: boolean;
    /** 当前 token */
    token: string | null;
    /** 当前登录的超管用户信息 */
    user: UserOut | null;
    /** 正在加载（探测权限中） */
    loading: boolean;
    /** 登出（清 token 并跳回主站） */
    logout: () => void;
    /** 重新拉取当前超管用户信息 */
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setTokenState] = useState<string | null>(null);
    const [user, setUser] = useState<UserOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);

    const refreshUser = useCallback(async () => {
        try {
            const u = await userInfo.get();
            setUser(u);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
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

        adminApi.probe()
            .then(async () => {
                try {
                    const u = await userInfo.get();
                    setUser(u);
                } catch {
                    /* ignore */
                }
                setLoading(false);
                setInitialized(true);
            })
            .catch((err: unknown) => {
                const errObj = err as { status?: number; code?: string; detail?: { code?: string } } | null;
                const isOobe = errObj?.status === 503 || errObj?.code === "ERR_SYSTEM_OOBE" || errObj?.detail?.code === "ERR_SYSTEM_OOBE";
                if (isOobe) {
                    if (typeof window !== "undefined" && window.location.pathname !== "/oobe" && !window.location.pathname.startsWith("/oobe")) {
                        window.location.href = "/oobe";
                    }
                    return;
                }
                if (errObj?.status === 429) {
                    setLoading(false);
                    setInitialized(true);
                    return;
                }
                clearToken();
                window.location.href = getMainSiteUrl();
            });
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setTokenState(null);
        setUser(null);
        window.location.href = getMainSiteUrl();
    }, []);

    const isAuthenticated = !!token && !loading && initialized;

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            token,
            user,
            loading,
            logout,
            refreshUser,
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
