"use client";

/**
 * Auth Token / SSO Exchange Code 接收页。
 *
 * 从 MINI ClassIsland Web 跳转而来，优先通过 URL Hash (#code=xxx) 兑换一次性 SSO Code，
 * 立即擦除地址栏痕迹并验证超管权限后跳转到管理面板首页。
 */

import React, { useEffect } from "react";
import { setToken, clearToken, getMainSiteUrl, token as tokenApi, userInfo } from "@/lib/api";
import { Spinner } from "@fluentui/react-components";

export default function AuthTransferPage() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        async function processTransfer() {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const code = hashParams.get("code");

            // 立即擦除地址栏中的敏感参数，防止历史记录或 Referer 泄露
            window.history.replaceState(null, "", "/auth");

            try {
                if (code) {
                    const res = await tokenApi.redeem(code);
                    setToken(res.token);
                    const u = await userInfo.get();
                    if (u && u.role_code === "superadmin") {
                        window.location.replace("/");
                        return;
                    }
                }
            } catch {
                /* ignore and redirect to main site */
            }
            clearToken();
            window.location.replace(getMainSiteUrl());
        }

        processTransfer();
    }, []);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <Spinner label="正在安全验证管理员权限并登录管理面板..." />
        </div>
    );
}
