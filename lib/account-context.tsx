"use client";

/**
 * 超级管理员全局租户账户上下文管理器。
 *
 * 超管无需加入 AccountMember 即可查看、切换并直接接管平台上的任意租户账户（包括停用账户），
 * 并在嵌套的集控管理页面中编辑其科目、时间表、课表、策略、组件、凭据、客户端、配对码与预注册。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { adminApi } from "./api";
import type { AccountOut } from "./types";

const STORAGE_KEY = "miniclassisland_admin_current_account_id";

interface AccountState {
    /** 平台上所有租户账户 */
    accounts: AccountOut[];
    /** 当前超管正在接管/编辑的租户账户 */
    currentAccount: AccountOut | null;
    /** 当前租户账户 ID 快捷访问 */
    accountId: string;
    /** 是否正在加载账户列表 */
    loading: boolean;
    /** 切换当前接管的租户账户 */
    switchAccount: (accountId: string) => void;
    /** 重新拉取全平台账户列表 */
    refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({
    children,
    isAuthenticated,
}: {
    children: ReactNode;
    isAuthenticated: boolean;
}) {
    const [accountList, setAccountList] = useState<AccountOut[]>([]);
    const [currentAccount, setCurrentAccount] = useState<AccountOut | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshAccounts = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const list = await adminApi.listAccounts();
            setAccountList(list);

            const urlAccountId = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("account_id")
                : null;
            const savedId = urlAccountId || (typeof window !== "undefined"
                ? localStorage.getItem(STORAGE_KEY)
                : null);

            const matched = savedId ? list.find(a => a.id === savedId || a.slug === savedId) : null;
            if (matched) {
                setCurrentAccount(matched);
                if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEY, matched.id);
                }
            } else if (list.length > 0) {
                setCurrentAccount(list[0]);
                if (typeof window !== "undefined") {
                    localStorage.setItem(STORAGE_KEY, list[0].id);
                }
            } else {
                setCurrentAccount(null);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            refreshAccounts();
        } else {
            setAccountList([]);
            setCurrentAccount(null);
        }
    }, [isAuthenticated, refreshAccounts]);

    const switchAccount = useCallback((id: string) => {
        const target = accountList.find(a => a.id === id || a.slug === id);
        if (target) {
            setCurrentAccount(target);
            if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEY, target.id);
            }
        }
    }, [accountList]);

    return (
        <AccountContext.Provider value={{
            accounts: accountList,
            currentAccount,
            accountId: currentAccount?.id || "",
            loading,
            switchAccount,
            refreshAccounts,
        }}>
            {children}
        </AccountContext.Provider>
    );
}

export function useAccount(): AccountState {
    const ctx = useContext(AccountContext);
    if (!ctx) throw new Error("useAccount must be used within AccountProvider");
    return ctx;
}
