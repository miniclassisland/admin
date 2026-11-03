"use client";

/**
 * Auth Token 接收页。
 *
 * 从 MINI ClassIsland Web 跳转而来，URL 带 ?token=xxx，
 * 存入 localStorage 后跳转到管理面板首页。
 */

import React, { useEffect } from "react";
import { setToken, getMainSiteUrl } from "@/lib/api";
import { Spinner } from "@fluentui/react-components";

export default function AuthTransferPage() {
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("token");
            if (token) {
                setToken(token);
                // 使用硬跳转避免 Next.js 路由复用 Layout 导致 AuthProvider 不执行探测
                window.location.replace("/");
            } else {
                window.location.replace(getMainSiteUrl());
            }
        }
    }, []);

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            <Spinner label="正在验证并登录管理面板..." />
        </div>
    );
}
