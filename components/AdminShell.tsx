"use client";

/**
 * Admin 壳层组件 — 对齐 MINI ClassIsland 主面板视觉风格（浅色侧栏 + 顶栏 + 主内容区）。
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMainSiteUrl } from "@/lib/api";
import { Spinner, Button } from "@fluentui/react-components";
import {
    Board24Regular,
    People24Regular,
    PersonAccounts24Regular,
    PersonClock24Regular,
    Settings24Regular,
    ArrowLeft24Regular,
    SignOut24Regular,
    ShieldKeyhole24Regular,
} from "@fluentui/react-icons";

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface NavGroup {
    title: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        title: "平台总览",
        items: [
            { label: "全局仪表盘", href: "/", icon: <Board24Regular /> },
        ],
    },
    {
        title: "用户与权限",
        items: [
            { label: "全局用户管理", href: "/users", icon: <People24Regular /> },
            { label: "注册审核", href: "/pending", icon: <PersonClock24Regular /> },
        ],
    },
    {
        title: "多租户与系统",
        items: [
            { label: "全局账户与配额", href: "/accounts", icon: <PersonAccounts24Regular /> },
            { label: "系统参数设置", href: "/settings", icon: <Settings24Regular /> },
        ],
    },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading, logout } = useAuth();
    const pathname = usePathname();

    if (pathname === "/auth" || pathname === "/auth/" || pathname.startsWith("/oobe")) {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "100vh",
            }}>
                <Spinner size="large" label="正在验证管理员权限..." />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    function isActive(href: string) {
        if (href === "/") return pathname === "/" || pathname === "";
        return pathname === href || pathname.startsWith(href + "/");
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icon.svg"
                        alt="MINI ClassIsland"
                        style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
                    />
                    <span>MINI ClassIsland</span>
                </div>

                <nav className="sidebar-nav">
                    {navGroups.map((group) => (
                        <React.Fragment key={group.title}>
                            <div className="sidebar-section-label">{group.title}</div>
                            {group.items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-item ${isActive(item.href) ? "active" : ""}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </React.Fragment>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <a
                        className="sidebar-item"
                        href={getMainSiteUrl()}
                    >
                        <ArrowLeft24Regular />
                        <span>返回集控主面板</span>
                    </a>
                </div>
            </aside>

            <div className="main-area">
                <header className="topbar">
                    <div className="topbar-left">
                        <span className="topbar-brand">MINI ClassIsland</span>
                        <span className="topbar-sep">/</span>
                        <span className="topbar-account" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ShieldKeyhole24Regular style={{ fontSize: 16 }} />
                            超级管理平台
                        </span>
                    </div>
                    <div className="topbar-right">
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<ArrowLeft24Regular />}
                            onClick={() => { window.location.href = getMainSiteUrl(); }}
                        >
                            集控主面板
                        </Button>
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<SignOut24Regular />}
                            onClick={logout}
                        >
                            登出
                        </Button>
                    </div>
                </header>
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
