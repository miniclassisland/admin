"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { adminApi, clients } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { ClientDeviceOut } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Button,
    Input,
    Spinner,
    Badge,
    Popover,
    PopoverTrigger,
    PopoverSurface,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    ArrowClockwise24Regular,
    ArrowSync24Regular,
    CheckmarkCircle24Regular,
    Delete24Regular,
    DismissCircle24Regular,
    PlugDisconnected24Regular,
    BuildingMultiple24Regular,
    Search24Regular,
    Filter16Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
} from "@fluentui/react-icons";

export default function GlobalClientsPage() {
    const router = useRouter();
    const { accounts, switchAccount } = useAccount();
    const [clientList, setClientList] = useState<ClientDeviceOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountFilter, setAccountFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "disabled">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadAllClients = useCallback(async () => {
        setLoading(true);
        try {
            const list = await adminApi.listAllClients({
                account_id: accountFilter !== "all" ? accountFilter : undefined,
            });
            setClientList(Array.isArray(list) ? list : []);
        } catch (err: unknown) {
            setMsg({
                type: "error",
                text: err instanceof Error ? err.message : "加载全局客户端列表失败",
            });
            setClientList([]);
        } finally {
            setLoading(false);
        }
    }, [accountFilter]);

    useEffect(() => {
        loadAllClients();
    }, [loadAllClients]);

    const filteredClients = useMemo(() => {
        return clientList.filter((c) => {
            if (statusFilter === "online" && c.status !== "online") return false;
            if (statusFilter === "offline" && c.status !== "offline") return false;
            if (statusFilter === "disabled" && !c.is_disabled) return false;
            return matchAdvancedQuery(c, searchQuery, {
                fields: {
                    status: (item) => {
                        const tags: string[] = [item.status];
                        if (item.is_disabled) tags.push("disabled");
                        return tags;
                    },
                    name: (item) => [item.display_name || "", item.client_id || ""],
                    uid: (item) => item.uid,
                    mac: (item) => item.mac || "",
                    ip: (item) => item.ip || "",
                    account: (item) => [item.account_name || "", item.account_slug || "", item.account_id || ""],
                    tag: (item) => [
                        item.client_id || "",
                        item.has_custom_profile ? "专属" : "默认",
                        item.ip || "",
                        item.account_name || "",
                    ],
                },
                freeText: (item) => [
                    item.uid,
                    item.client_id,
                    item.display_name,
                    item.mac,
                    item.ip,
                    item.account_name,
                    item.account_slug,
                    item.account_id,
                ],
            });
        });
    }, [clientList, statusFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedClients = filteredClients.slice((safePage - 1) * pageSize, safePage * pageSize);

    const onlineCount = clientList.filter((c) => c.status === "online" && !c.is_disabled).length;
    const offlineCount = clientList.filter((c) => c.status === "offline" && !c.is_disabled).length;
    const disabledCount = clientList.filter((c) => c.is_disabled).length;

    function handleJumpToTenantClients(targetAccountId?: string) {
        if (!targetAccountId) return;
        switchAccount(targetAccountId);
        router.push("/clients");
    }

    async function handleClientAction(
        c: ClientDeviceOut,
        action: "sync" | "restart" | "disconnect" | "enable" | "disable" | "delete"
    ) {
        const targetAcct = c.account_id || "default";
        const key = `${action}:${targetAcct}:${c.uid}`;
        setActionLoading(key);
        setMsg(null);
        try {
            if (action === "sync") {
                const r = await clients.forceSync(targetAcct, c.uid);
                setMsg({
                    type: r.status === "success" ? "success" : "error",
                    text: r.message || (r.status === "success" ? "已下发强制同步指令" : "客户端当前离线"),
                });
            } else if (action === "restart") {
                const r = await clients.restart(targetAcct, c.uid);
                setMsg({
                    type: r.status === "success" ? "success" : "error",
                    text: r.message || (r.status === "success" ? "已下发重启指令" : "客户端当前离线"),
                });
            } else if (action === "disconnect") {
                await clients.disconnect(targetAcct, c.uid);
                setMsg({ type: "success", text: `已断开客户端 ${c.display_name || c.uid}` });
            } else if (action === "enable") {
                await clients.enable(targetAcct, c.uid);
                setMsg({ type: "success", text: `已启用客户端 ${c.display_name || c.uid}` });
            } else if (action === "disable") {
                await clients.disable(targetAcct, c.uid);
                setMsg({ type: "success", text: `已禁用客户端 ${c.display_name || c.uid}` });
            } else if (action === "delete") {
                await clients.delete(targetAcct, c.uid);
                setMsg({ type: "success", text: `已移除客户端 ${c.display_name || c.uid}` });
            }
            await loadAllClients();
        } catch (err: unknown) {
            setMsg({
                type: "error",
                text: err instanceof Error ? err.message : "操作失败",
            });
        } finally {
            setActionLoading(null);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 className="page-title">全局客户端管理</h1>
                    <p className="page-subtitle">
                        跨租户查看与管理全平台所有已注册的 ClassIsland 终端设备（共 {clientList.length} 台，在线 {onlineCount} 台，离线 {offlineCount} 台，已禁用 {disabledCount} 台）
                    </p>
                </div>
                <div className="action-group">
                    <Button
                        appearance="secondary"
                        icon={<ArrowClockwise24Regular />}
                        onClick={loadAllClients}
                        disabled={loading}
                    >
                        刷新列表
                    </Button>
                </div>
            </div>

            {msg && (
                <MessageBar intent={msg.type} className="mb-16">
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="clients-main-pane">
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索客户端名称、设备标识、所属账户或高级过滤表达式"
                            value={searchQuery}
                            onChange={(_, d) => {
                                setSearchQuery(d.value);
                                setCurrentPage(1);
                            }}
                            contentBefore={<Search24Regular />}
                            style={{ flex: 1, minWidth: 240, fontFamily: "var(--font-mono)" }}
                        />

                        <Popover withArrow positioning="below-end">
                            <PopoverTrigger disableButtonEnhancement>
                                <Button appearance="outline" icon={<Filter16Regular />}>
                                    筛选
                                </Button>
                            </PopoverTrigger>
                            <PopoverSurface style={{ padding: 12, width: 300 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>所属租户账户</div>
                                    <Select
                                        size="small"
                                        value={accountFilter}
                                        onChange={(_, d) => {
                                            setAccountFilter(d.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部租户账户</option>
                                        {accounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name}
                                            </option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>状态快速过滤</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as "all" | "online" | "offline" | "disabled");
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部状态 ({clientList.length})</option>
                                        <option value="online">仅看在线 ({onlineCount})</option>
                                        <option value="offline">仅看离线 ({offlineCount})</option>
                                        <option value="disabled">已禁用 ({disabledCount})</option>
                                    </Select>
                                </div>
                            </PopoverSurface>
                        </Popover>
                    </div>

                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 12.5,
                            color: "var(--text-secondary)",
                            display: "flex",
                            gap: 14,
                        }}
                    >
                        <span>{clientList.length}个客户端</span>
                        <span>{filteredClients.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner label="正在加载全平台客户端设备..." />
                        </div>
                    ) : pagedClients.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的客户端设备</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>所属租户账户</th>
                                    <th>设备名称 / 班级标识</th>
                                    <th>状态</th>
                                    <th>客户端 UID</th>
                                    <th>MAC / 最近 IP</th>
                                    <th>下发档案策略</th>
                                    <th>最后在线时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedClients.map((c) => {
                                    const acctId = c.account_id || "default";
                                    return (
                                        <tr key={`${acctId}:${c.uid}`}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>
                                                    {c.account_name || acctId}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    <code>{c.account_slug || acctId}</code>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>
                                                    {c.display_name || c.client_id || "未命名设备"}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    班级标识: <code>{c.client_id || "-"}</code>
                                                </div>
                                            </td>
                                            <td>
                                                {c.is_disabled ? (
                                                    <Badge appearance="filled" color="danger">
                                                        已禁用
                                                    </Badge>
                                                ) : c.status === "online" ? (
                                                    <Badge appearance="filled" color="success">
                                                        在线
                                                    </Badge>
                                                ) : (
                                                    <Badge appearance="outline" color="subtle">
                                                        离线
                                                    </Badge>
                                                )}
                                            </td>
                                            <td>
                                                <code style={{ fontSize: 12 }}>{c.uid}</code>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 12 }}>
                                                    MAC: <code>{c.mac || "-"}</code>
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                    IP: <code>{c.ip || "-"}</code>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge
                                                    appearance="tint"
                                                    color={c.has_custom_profile ? "brand" : "informative"}
                                                >
                                                    {c.has_custom_profile ? "独立档案" : "跟随账户默认"}
                                                </Badge>
                                            </td>
                                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                                {c.last_seen_at
                                                    ? new Date(c.last_seen_at).toLocaleString("zh-CN")
                                                    : c.registered_at
                                                        ? new Date(c.registered_at).toLocaleString("zh-CN")
                                                        : "-"}
                                            </td>
                                            <td>
                                                <div className="action-group" style={{ flexWrap: "wrap", gap: 6 }}>
                                                    <Button
                                                        size="small"
                                                        appearance="secondary"
                                                        icon={<BuildingMultiple24Regular />}
                                                        onClick={() => handleJumpToTenantClients(c.account_id)}
                                                        title="切换到该租户客户端管理页"
                                                    >
                                                        进入租户管理
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        appearance="subtle"
                                                        icon={<ArrowSync24Regular />}
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleClientAction(c, "sync")}
                                                        title="强制下发同步配置"
                                                    >
                                                        同步
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        appearance="subtle"
                                                        icon={<PlugDisconnected24Regular />}
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleClientAction(c, "disconnect")}
                                                        title="断开客户端连接"
                                                    >
                                                        断连
                                                    </Button>
                                                    {c.is_disabled ? (
                                                        <Button
                                                            size="small"
                                                            appearance="subtle"
                                                            icon={<CheckmarkCircle24Regular />}
                                                            disabled={actionLoading !== null}
                                                            onClick={() => handleClientAction(c, "enable")}
                                                        >
                                                            启用
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="small"
                                                            appearance="subtle"
                                                            icon={<DismissCircle24Regular />}
                                                            disabled={actionLoading !== null}
                                                            onClick={() => handleClientAction(c, "disable")}
                                                        >
                                                            禁用
                                                        </Button>
                                                    )}
                                                    <ConfirmPopover
                                                        message={`确定从账户「${c.account_name || acctId}」移除客户端「${c.display_name || c.client_id || c.uid}」吗？`}
                                                        onConfirm={() => handleClientAction(c, "delete")}
                                                        confirmText="移除"
                                                        disabled={actionLoading !== null}
                                                    >
                                                        <Button
                                                            size="small"
                                                            appearance="subtle"
                                                            icon={<Delete24Regular />}
                                                            disabled={actionLoading !== null}
                                                            style={{ color: "var(--danger-color)" }}
                                                        >
                                                            移除
                                                        </Button>
                                                    </ConfirmPopover>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="clients-pagination-bar">
                    <div className="flex items-center gap-8">
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<ChevronLeft16Regular />}
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        />
                        <span className="mono-code" style={{ fontWeight: 600 }}>
                            {safePage} / {totalPages}
                        </span>
                        <Button
                            size="small"
                            appearance="subtle"
                            icon={<ChevronRight16Regular />}
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        />
                        <span style={{ marginLeft: 6 }}>
                            {loading ? "正在加载" : "加载完毕"}
                        </span>
                    </div>

                    <div className="flex items-center gap-6">
                        <span>每页</span>
                        <Select
                            size="small"
                            value={String(pageSize)}
                            onChange={(_, d) => {
                                setPageSize(Number(d.value) || 20);
                                setCurrentPage(1);
                            }}
                            style={{ width: 72 }}
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </Select>
                        <span>条</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
