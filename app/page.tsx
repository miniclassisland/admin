"use client";

/**
 * MINI ClassIsland 超级管理平台 — 全局统计概览仪表盘。
 * 调用 Admin API: GET /stats
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api";
import type { PlatformStats } from "@/lib/types";
import { Spinner, Button } from "@fluentui/react-components";
import VersionLine from "@/components/VersionLine";
import {
    People24Regular,
    PersonAccounts24Regular,
    PersonClock24Regular,
    Desktop24Regular,
    PlugConnected24Regular,
    DocumentText24Regular,
    Settings24Regular,
    ArrowClockwise24Regular,
} from "@fluentui/react-icons";

function AdminStatCard({
    icon,
    label,
    value,
    sublabel,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sublabel?: string;
    color?: string;
}) {
    return (
        <div className="stat-card">
            <div className="flex items-center gap-8" style={{ color: color || "var(--accent-color)", marginBottom: 4 }}>
                {icon}
                <span className="stat-value" style={{ color: "var(--text-primary)" }}>{value}</span>
            </div>
            <div className="stat-label">{label}</div>
            {sublabel && (
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                    {sublabel}
                </div>
            )}
        </div>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    async function loadStats() {
        setLoading(true);
        try {
            const data = await adminApi.getStats();
            setStats(data);
        } catch {
            // fallback to list counts if needed
            try {
                const [accts, users, pending] = await Promise.allSettled([
                    adminApi.listAccounts(),
                    adminApi.listUsers(0, 100),
                    adminApi.listPendingUsers(),
                ]);
                const acctList = accts.status === "fulfilled" ? accts.value : [];
                setStats({
                    total_accounts: acctList.length,
                    active_accounts: acctList.filter(a => a.is_active).length,
                    total_users: users.status === "fulfilled" ? users.value.length : 0,
                    pending_users: pending.status === "fulfilled" ? pending.value.length : 0,
                    total_clients: 0,
                    online_clients: 0,
                    total_audit_logs: 0,
                });
            } catch {
                /* keep null */
            }
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ height: 220 }}>
                <Spinner size="medium" label="加载全局指标中..." />
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">全局仪表盘</h1>
                    <p className="page-subtitle">MINI ClassIsland 集中管理平台全局运行指标与租户概览</p>
                </div>
                <Button
                    size="small"
                    appearance="secondary"
                    icon={<ArrowClockwise24Regular />}
                    onClick={loadStats}
                >
                    刷新统计
                </Button>
            </div>

            <div className="stat-grid">
                <AdminStatCard
                    icon={<PersonAccounts24Regular />}
                    label="总租户账户数"
                    value={stats?.total_accounts ?? "-"}
                    sublabel={`活跃账户: ${stats?.active_accounts ?? "-"}`}
                    color="#0078d4"
                />
                <AdminStatCard
                    icon={<People24Regular />}
                    label="平台注册用户"
                    value={stats?.total_users ?? "-"}
                    sublabel={`待审核: ${stats?.pending_users ?? 0}`}
                    color="#0078d4"
                />
                <AdminStatCard
                    icon={<PersonClock24Regular />}
                    label="待审核申请"
                    value={stats?.pending_users ?? "-"}
                    sublabel="新注册待审批账号"
                    color="#ffb900"
                />
                <AdminStatCard
                    icon={<Desktop24Regular />}
                    label="全平台注册终端"
                    value={stats?.total_clients ?? "-"}
                    sublabel="所有租户下已登记设备"
                    color="#0078d4"
                />
                <AdminStatCard
                    icon={<PlugConnected24Regular />}
                    label="当前在线终端"
                    value={stats?.online_clients ?? "-"}
                    sublabel="gRPC 实时长连接会话"
                    color="#107c10"
                />
                <AdminStatCard
                    icon={<DocumentText24Regular />}
                    label="累计审计事件"
                    value={stats?.total_audit_logs ?? "-"}
                    sublabel="客户端上报的审计日志总数"
                    color="#616161"
                />
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-title">用户与权限治理</div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                        管理全平台所有用户账号、系统角色（普通用户、管理员、超级管理员）、建号权限、两步验证重置以及新用户注册审核。
                    </p>
                    <div className="flex gap-8">
                        <Link href="/users" style={{ textDecoration: "none" }}>
                            <Button appearance="primary" size="small" icon={<People24Regular />}>
                                全局用户管理
                            </Button>
                        </Link>
                        <Link href="/pending" style={{ textDecoration: "none" }}>
                            <Button appearance="secondary" size="small" icon={<PersonClock24Regular />}>
                                注册审核 ({stats?.pending_users ?? 0})
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="card">
                    <div className="card-title">多租户账户与配额</div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                        查看并管理所有租户账户的启停状态、子域名 Slug、设备接入模式（开放注册 / 配对码 / 预注册白名单）与终端容量配额。
                    </p>
                    <div className="flex gap-8">
                        <Link href="/accounts" style={{ textDecoration: "none" }}>
                            <Button appearance="primary" size="small" icon={<PersonAccounts24Regular />}>
                                全局账户与配额
                            </Button>
                        </Link>
                        <Link href="/settings" style={{ textDecoration: "none" }}>
                            <Button appearance="secondary" size="small" icon={<Settings24Regular />}>
                                系统参数设置
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-color)",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                }}
            >
                <VersionLine />
            </div>
        </div>
    );
}
