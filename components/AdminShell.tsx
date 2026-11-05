"use client";

/**
 * Admin 壳层组件 — 超管全局控制台 + 嵌套主站全量租户集控功能。
 * 支持超管随时在顶栏/侧边栏切换全平台任意租户账户，无需加入 AccountMember 即可直接编辑其 7 大集控资源、客户端、配对码、预注册、配额等。
 */

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { ThemeModeToggle } from "@/lib/theme-context";
import { getMainSiteUrl, getToken, token as tokenApi } from "@/lib/api";
import { REGISTRATION_MODE_LABELS } from "@/lib/types";
import { Spinner, Button, Badge } from "@fluentui/react-components";
import { Select } from "./CustomSelect";
import RateLimitBanner from "./RateLimitBanner";
import {
    Board24Regular,
    People24Regular,
    PersonAccounts24Regular,
    PersonClock24Regular,
    Settings24Regular,
    ArrowLeft24Regular,
    SignOut24Regular,
    ShieldKeyhole24Regular,
    Home24Regular,
    Book24Regular,
    Clock24Regular,
    ShieldTask24Regular,
    Apps24Regular,
    Key24Regular,
    PlugConnected24Regular,
    Send24Regular,
    DocumentSearch24Regular,
    Link24Regular,
    Laptop24Regular,
    PeopleAdd24Regular,
    DataBarVertical24Regular,
    BuildingMultiple24Regular,
    Navigation24Regular,
    Dismiss24Regular,
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

const globalNavGroups: NavGroup[] = [
    {
        title: "全局平台治理",
        items: [
            { label: "全局仪表盘", href: "/", icon: <Board24Regular /> },
            { label: "全局用户管理", href: "/users", icon: <People24Regular /> },
            { label: "注册审核", href: "/pending", icon: <PersonClock24Regular /> },
            { label: "全局账户与配额", href: "/accounts", icon: <PersonAccounts24Regular /> },
            { label: "系统参数设置", href: "/settings", icon: <Settings24Regular /> },
        ],
    },
];

const tenantNavGroups: NavGroup[] = [
    {
        title: "租户集控 · 概览与档案",
        items: [
            { label: "租户仪表盘", href: "/dashboard", icon: <Home24Regular /> },
            { label: "科目管理", href: "/profiles/subjects", icon: <Book24Regular /> },
            { label: "时间表管理", href: "/profiles/timelayout", icon: <Clock24Regular /> },
            { label: "课表管理", href: "/profiles/classplan", icon: <Board24Regular /> },
            { label: "策略管理", href: "/profiles/policy", icon: <ShieldTask24Regular /> },
            { label: "默认设置", href: "/profiles/settings", icon: <Settings24Regular /> },
            { label: "组件设置", href: "/profiles/components", icon: <Apps24Regular /> },
            { label: "凭据管理", href: "/profiles/credentials", icon: <Key24Regular /> },
        ],
    },
    {
        title: "租户集控 · 终端与接入",
        items: [
            { label: "客户端管理", href: "/clients", icon: <PlugConnected24Regular /> },
            { label: "通知推送", href: "/notifications", icon: <Send24Regular /> },
            { label: "审计日志", href: "/audit", icon: <DocumentSearch24Regular /> },
            { label: "配对码管理", href: "/pairing", icon: <Link24Regular /> },
            { label: "预注册客户端", href: "/pre-registration", icon: <Laptop24Regular /> },
        ],
    },
    {
        title: "租户集控 · 账户与权限",
        items: [
            { label: "租户概览与配额", href: "/tenant-account", icon: <PersonAccounts24Regular /> },
            { label: "访问控制", href: "/access", icon: <PeopleAdd24Regular /> },
            { label: "邀请管理", href: "/invitations", icon: <PeopleAdd24Regular /> },
            { label: "超管个人安全", href: "/security", icon: <DataBarVertical24Regular /> },
        ],
    },
];

const GLOBAL_PATHS = ["/", "/users", "/pending", "/accounts", "/settings"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading, logout } = useAuth();
    const { accounts, currentAccount, accountId, switchAccount } = useAccount();
    const pathname = usePathname();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    React.useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname, accountId]);

    if (pathname === "/auth" || pathname === "/auth/" || pathname.startsWith("/oobe")) {
        return (
            <>
                <RateLimitBanner />
                <ThemeModeToggle floating />
                {children}
            </>
        );
    }

    if (loading) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: "100vh",
            }}>
                <RateLimitBanner />
                <ThemeModeToggle floating />
                <Spinner size="large" label="正在验证管理员权限..." />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <RateLimitBanner />;
    }

    function isActive(href: string) {
        if (href === "/") return pathname === "/" || pathname === "";
        return pathname === href || pathname.startsWith(href + "/");
    }

    const isGlobalPage = GLOBAL_PATHS.some((p) =>
        p === "/" ? pathname === "/" || pathname === "" : pathname === p || pathname.startsWith(p + "/")
    );

    async function handleReturnToMainSite(e?: React.MouseEvent) {
        if (e) e.preventDefault();
        const mainUrl = getMainSiteUrl();
        if (getToken()) {
            try {
                const { code } = await tokenApi.exchange();
                window.location.href = `${mainUrl.replace(/\/$/, "")}/auth#code=${encodeURIComponent(code)}`;
                return;
            } catch {
                /* fallback to direct main site navigation */
            }
        }
        window.location.href = mainUrl;
    }

    return (
        <div className="app-shell">
            <RateLimitBanner />
            {mobileMenuOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}
            <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
                <div className="sidebar-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icon.svg"
                        alt="MINI ClassIsland"
                        style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1 }}>MINI ClassIsland</span>
                    <button
                        type="button"
                        className="mobile-drawer-close"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="关闭导航菜单"
                    >
                        <Dismiss24Regular />
                    </button>
                </div>

                {/* 超管全局租户快速切换器 */}
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-accent-subtle)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-color)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <BuildingMultiple24Regular style={{ width: 14, height: 14 }} />
                        <span>当前接管租户 ({accounts.length})</span>
                    </div>
                    <Select
                        size="small"
                        value={accountId}
                        onChange={(_, d) => switchAccount(d.value)}
                        style={{ width: "100%" }}
                    >
                        {accounts.length === 0 ? (
                            <option value="">暂无租户账户</option>
                        ) : (
                            accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.slug}){!a.is_active ? " [已停用]" : ""}
                                </option>
                            ))
                        )}
                    </Select>
                </div>

                <nav className="sidebar-nav">
                    {globalNavGroups.map((group) => (
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

                    {tenantNavGroups.map((group) => (
                        <React.Fragment key={group.title}>
                            <div className="sidebar-section-label" style={{ color: "var(--accent-color)" }}>
                                {group.title}
                            </div>
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
                        onClick={handleReturnToMainSite}
                    >
                        <ArrowLeft24Regular />
                        <span>返回集控主面板</span>
                    </a>
                </div>
            </aside>

            <div className="main-area">
                <header className="topbar">
                    <div className="topbar-left">
                        <button
                            type="button"
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen((v) => !v)}
                            aria-label="打开导航菜单"
                            title="导航菜单"
                        >
                            <Navigation24Regular />
                        </button>
                        <span className="topbar-account" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <ShieldKeyhole24Regular style={{ fontSize: 16 }} />
                            超管平台
                        </span>
                        {currentAccount && (
                            <>
                                <span className="topbar-sep topbar-tenant-sep">/</span>
                                <span className="topbar-tenant-info" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    当前接管租户：<strong style={{ color: "var(--text-primary)" }}>{currentAccount.name}</strong>
                                    <span className="api-key-cell" style={{ marginLeft: 6 }}>{currentAccount.slug}</span>
                                </span>
                            </>
                        )}
                    </div>
                    <div className="topbar-right">
                        <ThemeModeToggle />
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<ArrowLeft24Regular />}
                            onClick={() => { void handleReturnToMainSite(); }}
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

                <main className="main-content" key={isGlobalPage ? "global" : accountId}>
                    {/* 当处于嵌套的租户集控页面时，顶部展示超管跨租户接管横幅 */}
                    {!isGlobalPage && currentAccount && (
                        <div
                            className="card mb-16"
                            style={{
                                padding: "12px 18px",
                                background: "var(--bg-banner-gradient)",
                                borderLeft: "4px solid var(--accent-color)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 12,
                            }}
                        >
                            <div className="flex items-center gap-12" style={{ flexWrap: "wrap" }}>
                                <Badge appearance="filled" color="brand">超管直管模式</Badge>
                                <span style={{ fontSize: 13.5 }}>
                                    正在管理租户：<strong>{currentAccount.name}</strong> (<code>{currentAccount.slug}</code>)
                                </span>
                                <Badge appearance="outline" color={currentAccount.is_active ? "success" : "severe"}>
                                    {currentAccount.is_active ? "账户活跃" : "账户已停用"}
                                </Badge>
                                <Badge appearance="outline" color="informative">
                                    {REGISTRATION_MODE_LABELS[currentAccount.registration_mode || "open"] || "开放接入"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-8">
                                <Select
                                    size="small"
                                    value={accountId}
                                    onChange={(_, d) => switchAccount(d.value)}
                                    style={{ minWidth: 200 }}
                                >
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            切换租户: {a.name} ({a.slug})
                                        </option>
                                    ))}
                                </Select>
                                <Button
                                    size="small"
                                    appearance="secondary"
                                    onClick={() => router.push("/tenant-account")}
                                >
                                    租户配额与概览
                                </Button>
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    onClick={() => router.push("/accounts")}
                                >
                                    返回全局账户表
                                </Button>
                            </div>
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}
