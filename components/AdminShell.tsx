"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAccount } from "@/lib/account-context";
import { ThemeModeToggle } from "@/lib/theme-context";
import { getMainSiteUrl, getToken, token as tokenApi, adminApi } from "@/lib/api";
import { REGISTRATION_MODE_LABELS } from "@/lib/types";
import { ADMIN_VERSION } from "@/lib/version";
import { Spinner, Button, Badge } from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "./ToastMessageBar";
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
    Book24Regular,
    Clock24Regular,
    ShieldTask24Regular,
    Apps24Regular,
    Key24Regular,
    PlugConnected24Regular,
    Link24Regular,
    Laptop24Regular,
    PeopleAdd24Regular,
    BuildingMultiple24Regular,
    Navigation24Regular,
    Dismiss24Regular,
    Headset24Regular,
    Grid24Regular,
    Document24Regular,
    ChevronDown16Regular,
    ChevronRight16Regular,
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

const TENANT_PROFILE_ITEMS: NavItem[] = [
    { label: "时间表", href: "/profiles/timelayout", icon: <Clock24Regular /> },
    { label: "课表", href: "/profiles/classplan", icon: <Board24Regular /> },
    { label: "科目", href: "/profiles/subjects", icon: <Book24Regular /> },
    { label: "策略", href: "/profiles/policy", icon: <ShieldTask24Regular /> },
    { label: "设置", href: "/profiles/settings", icon: <Settings24Regular /> },
    { label: "组件", href: "/profiles/components", icon: <Apps24Regular /> },
    { label: "凭据", href: "/profiles/credentials", icon: <Key24Regular /> },
];

const TENANT_SETTINGS_ITEMS: NavItem[] = [
    { label: "租户概览与配额", href: "/tenant-account", icon: <PersonAccounts24Regular /> },
    { label: "配对码管理", href: "/pairing", icon: <Link24Regular /> },
    { label: "预注册客户端", href: "/pre-registration", icon: <Laptop24Regular /> },
    { label: "访问控制", href: "/access", icon: <PeopleAdd24Regular /> },
    { label: "邀请管理", href: "/invitations", icon: <PeopleAdd24Regular /> },
];

const GLOBAL_PATHS = ["/", "/users", "/pending", "/accounts", "/global-clients", "/settings", "/tickets"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading, logout } = useAuth();
    const { accounts, currentAccount, accountId, switchAccount } = useAccount();
    const pathname = usePathname();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profilesOpen, setProfilesOpen] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(() =>
        TENANT_SETTINGS_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    );
    const [coreVersion, setCoreVersion] = useState("...");

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname, accountId]);

    useEffect(() => {
        if (pathname.startsWith("/profiles")) {
            setProfilesOpen(true);
        }
        if (TENANT_SETTINGS_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))) {
            setSettingsOpen(true);
        }
    }, [pathname]);

    useEffect(() => {
        let cancelled = false;
        adminApi.getVersion()
            .then((res) => {
                if (!cancelled && res?.version) setCoreVersion(res.version);
            })
            .catch(() => {
                if (!cancelled) setCoreVersion("build");
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
                window.location.assign(`${mainUrl.replace(/\/$/, "")}/auth#code=${encodeURIComponent(code)}`);
                return;
            } catch {
                /* fallback to direct main site navigation */
            }
        }
        window.location.assign(mainUrl);
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
                    <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        MINI ClassIsland
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
                        <div className="sidebar-section" style={{ gap: 4 }}>
                            <Link
                                href="/accounts"
                                className="sidebar-item"
                            >
                                <ArrowLeft24Regular />
                                <span>返回租户账户与配额</span>
                            </Link>

                            <Link
                                href="/dashboard"
                                className={`sidebar-item ${isActive("/dashboard") ? "active" : ""}`}
                            >
                                <Grid24Regular />
                                <span>状态速览</span>
                            </Link>

                            <Link
                                href="/clients"
                                className={`sidebar-item ${isActive("/clients") || isActive("/audit") || isActive("/notifications") ? "active" : ""}`}
                            >
                                <Laptop24Regular />
                                <span>客户端</span>
                            </Link>

                            <div>
                                <button
                                    type="button"
                                    className="sidebar-group-toggle"
                                    onClick={() => setProfilesOpen((v) => !v)}
                                >
                                    <span className="sidebar-group-toggle-left">
                                        <Document24Regular />
                                        <span>配置管理</span>
                                    </span>
                                    {profilesOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                                </button>
                                {profilesOpen && (
                                    <div className="sidebar-sub-items">
                                        {TENANT_PROFILE_ITEMS.map((item) => (
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
                                )}
                            </div>

                            <div>
                                <button
                                    type="button"
                                    className="sidebar-group-toggle"
                                    onClick={() => setSettingsOpen((v) => !v)}
                                >
                                    <span className="sidebar-group-toggle-left">
                                        <Settings24Regular />
                                        <span>设置</span>
                                    </span>
                                    {settingsOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                                </button>
                                {settingsOpen && (
                                    <div className="sidebar-sub-items">
                                        {TENANT_SETTINGS_ITEMS.map((item) => (
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
                                )}
                            </div>
                        </div>
                    )}
                </nav>

                <div className="sidebar-sketch-footer">
                    <a
                        className="sidebar-item"
                        href={getMainSiteUrl()}
                        onClick={handleReturnToMainSite}
                    >
                        <ArrowLeft24Regular />
                        <span>返回集控主面板</span>
                    </a>

                    <div className="sidebar-footer-links">
                        <a
                            href="https://github.com/miniclassisland/miniclassisland"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sidebar-footer-link"
                        >
                            GitHub
                        </a>
                        <span className="sidebar-footer-sep">·</span>
                        <a
                            href="https://qm.qq.com/q/4AsF0S1UNa"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sidebar-footer-link"
                        >
                            加入社区
                        </a>
                    </div>

                    <div className="sidebar-version-bar">
                        网页版本 {ADMIN_VERSION} | 核心版本 {coreVersion}
                    </div>
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
                            className="topbar-logout-btn"
                            icon={<ArrowLeft24Regular />}
                            onClick={() => { void handleReturnToMainSite(); }}
                            aria-label="集控主面板"
                        >
                            <span className="topbar-btn-label">集控主面板</span>
                        </Button>
                        <Button
                            appearance="subtle"
                            size="small"
                            className="topbar-logout-btn"
                            icon={<SignOut24Regular />}
                            onClick={logout}
                            aria-label="登出"
                        >
                            <span className="topbar-btn-label">登出</span>
                        </Button>
                    </div>
                </header>

                <main className="main-content" key={isGlobalPage ? "global" : accountId}>
                    {!isGlobalPage && currentAccount && (
                        <MessageBar intent="info" autoHideMs={5000}>
                            <MessageBarBody>
                                <div className="flex items-center justify-between gap-12" style={{ flexWrap: "wrap" }}>
                                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap", minWidth: 0 }}>
                                        <Badge appearance="filled" color="brand">超管直管模式</Badge>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>
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
                            </MessageBarBody>
                        </MessageBar>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}
