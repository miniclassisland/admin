"use client";

/**
 * Admin 壳层组件 — 超管全局控制台 + 独立租户集控模块。
 * 默认状态下展示无租户属性的「全局平台治理」视图；
 * 进入租户集控模块后，侧栏展示租户导航，右上角顶栏提供租户接管选择器。
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
    ArrowLeft16Regular,
    ArrowRight16Regular,
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
    BuildingMultiple24Regular,
    Navigation24Regular,
    Dismiss24Regular,
    Headset24Regular,
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
            { label: "租户账户与配额", href: "/accounts", icon: <BuildingMultiple24Regular /> },
            { label: "全局客户端管理", href: "/global-clients", icon: <PlugConnected24Regular /> },
            { label: "工单处理", href: "/tickets", icon: <Headset24Regular /> },
            { label: "系统参数设置", href: "/settings", icon: <Settings24Regular /> },
        ],
    },
];

const tenantNavGroups: NavGroup[] = [
    {
        title: "概览与档案",
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
        title: "终端与接入",
        items: [
            { label: "客户端管理", href: "/clients", icon: <PlugConnected24Regular /> },
            { label: "通知推送", href: "/notifications", icon: <Send24Regular /> },
            { label: "审计日志", href: "/audit", icon: <DocumentSearch24Regular /> },
            { label: "配对码管理", href: "/pairing", icon: <Link24Regular /> },
            { label: "预注册客户端", href: "/pre-registration", icon: <Laptop24Regular /> },
        ],
    },
    {
        title: "账户与权限",
        items: [
            { label: "租户概览与配额", href: "/tenant-account", icon: <PersonAccounts24Regular /> },
            { label: "访问控制", href: "/access", icon: <PeopleAdd24Regular /> },
            { label: "邀请管理", href: "/invitations", icon: <PeopleAdd24Regular /> },
        ],
    },
];

const GLOBAL_PATHS = ["/", "/users", "/pending", "/accounts", "/global-clients", "/settings", "/tickets"];

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
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            MINI ClassIsland
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {isGlobalPage ? "超管全局治理" : (currentAccount?.name || "租户集控管理")}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="mobile-drawer-close"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="关闭导航菜单"
                    >
                        <Dismiss24Regular />
                    </button>
                </div>

                {!isGlobalPage && (
                    <div className="sidebar-tenant-box">
                        <Link href="/accounts" className="sidebar-back-link">
                            <ArrowLeft16Regular />
                            <span>返回租户账户与配额</span>
                        </Link>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {isGlobalPage ? (
                        globalNavGroups.map((group) => (
                            <div key={group.title} className="sidebar-section">
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
                            </div>
                        ))
                    ) : (
                        tenantNavGroups.map((group) => (
                            <div key={group.title} className="sidebar-section">
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
                            </div>
                        ))
                    )}
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
                        <span className="topbar-account" style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                            <ShieldKeyhole24Regular style={{ fontSize: 16 }} />
                            <span>{isGlobalPage ? "超管平台" : "超管平台 · 租户集控"}</span>
                        </span>
                    </div>
                    <div className="topbar-right">
                        {!isGlobalPage && (
                            <div className="flex items-center gap-6" style={{ minWidth: 0 }}>
                                <Select
                                    size="small"
                                    value={accountId || ""}
                                    onChange={(_, d) => {
                                        if (!d.value) return;
                                        switchAccount(d.value);
                                    }}
                                    style={{ width: 200, maxWidth: "28vw" }}
                                >
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}{!a.is_active ? " · 已停用" : ""}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
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
                            <div className="flex items-center gap-12" style={{ flexWrap: "wrap", minWidth: 0 }}>
                                <Badge appearance="filled" color="brand">超管直管模式</Badge>
                                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                                    {currentAccount.name}
                                </span>
                                <Badge appearance="outline" color={currentAccount.is_active ? "success" : "severe"}>
                                    {currentAccount.is_active ? "账户活跃" : "账户已停用"}
                                </Badge>
                                <Badge appearance="outline" color="informative">
                                    {REGISTRATION_MODE_LABELS[currentAccount.registration_mode || "pairing"] || "配对码审批接入"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
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
                                    onClick={() => router.push("/")}
                                >
                                    返回全局治理
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
