"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { adminApi } from "@/lib/api";
import type { UserOut } from "@/lib/types";
import { QUOTA_META } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Button,
    Spinner,
    Badge,
    Input,
    Switch,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Checkmark24Regular,
    Dismiss24Regular,
    PersonClock24Regular,
    ArrowClockwise24Regular,
    Search24Regular,
    DataUsage24Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
} from "@fluentui/react-icons";

function buildDefaultQuotaDraft(): Record<string, number> {
    const draft: Record<string, number> = {};
    for (const [key, meta] of Object.entries(QUOTA_META)) {
        draft[key] = meta.defaultMax;
    }
    return draft;
}

export default function PendingUsersPage() {
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const [approvingUser, setApprovingUser] = useState<UserOut | null>(null);
    const [quotaDraft, setQuotaDraft] = useState<Record<string, number>>(buildDefaultQuotaDraft);

    const loadPending = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await adminApi.listPendingUsers();
            setUsers(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPending();
    }, [loadPending]);

    const filteredUsers = useMemo(() => {
        return users.filter((u) =>
            matchAdvancedQuery(u, searchQuery, {
                fields: {
                    name: (item) => [item.username, item.display_name || ""],
                    email: (item) => item.email,
                    id: (item) => item.id,
                },
                freeText: (item) => [
                    item.username,
                    item.email,
                    item.display_name,
                    item.id,
                ],
            })
        );
    }, [users, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

    function openApproveModal(user: UserOut) {
        setApprovingUser(user);
        setQuotaDraft(buildDefaultQuotaDraft());
    }

    async function handleConfirmApprove() {
        if (!approvingUser) return;
        const target = approvingUser;
        setProcessing(target.id);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.approveUser(target.id, { quotas: quotaDraft });
            setApprovingUser(null);
            setSuccessMsg(`已批准用户 ${target.username}，并为其初始化默认账户与资源配额`);
            await loadPending();
        } catch (e) {
            setError(e instanceof Error ? e.message : "操作失败");
        } finally {
            setProcessing(null);
        }
    }

    async function handleReject(user: UserOut) {
        setProcessing(user.id);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.rejectUser(user.id);
            setSuccessMsg(`已拒绝用户 ${user.username} 的注册申请`);
            await loadPending();
        } catch (e) {
            setError(e instanceof Error ? e.message : "操作失败");
        } finally {
            setProcessing(null);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">注册审核</h1>
                    <p className="page-subtitle">审批新注册的用户申请并同时配置初始配额</p>
                </div>
                <Button
                    appearance="secondary"
                    icon={<ArrowClockwise24Regular />}
                    onClick={loadPending}
                >
                    刷新列表
                </Button>
            </div>

            {error && (
                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}

            {successMsg && (
                <MessageBar intent="success" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{successMsg}</MessageBarBody>
                </MessageBar>
            )}

            <div className="clients-main-pane">
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索待审核用户名、邮箱或显示名"
                            value={searchQuery}
                            onChange={(_, d) => {
                                setSearchQuery(d.value);
                                setCurrentPage(1);
                            }}
                            contentBefore={<Search24Regular />}
                            style={{ flex: 1, minWidth: 240, fontFamily: "var(--font-mono)" }}
                        />
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
                        <span>{users.length}条待审核申请</span>
                        <span>{filteredUsers.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="empty-state">
                            <PersonClock24Regular />
                            <div className="empty-state-text">当前没有待审核的注册申请</div>
                        </div>
                    ) : pagedUsers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的申请记录</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>邮箱</th>
                                    <th>显示名</th>
                                    <th>申请时间</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUsers.map((u) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500 }}>{u.username}</td>
                                        <td>{u.email}</td>
                                        <td>{u.display_name || "-"}</td>
                                        <td>{new Date(u.created_at).toLocaleString("zh-CN")}</td>
                                        <td>
                                            <Badge color="warning">待审核</Badge>
                                        </td>
                                        <td>
                                            <div className="flex gap-8">
                                                <Button
                                                    appearance="primary"
                                                    icon={<Checkmark24Regular />}
                                                    size="small"
                                                    onClick={() => openApproveModal(u)}
                                                    disabled={processing === u.id}
                                                >
                                                    {processing === u.id ? <Spinner size="tiny" /> : "批准并设配额"}
                                                </Button>
                                                <ConfirmPopover
                                                    message={`确定要拒绝并移除用户「${u.username}」的注册申请吗？`}
                                                    onConfirm={() => handleReject(u)}
                                                    confirmText="确认拒绝"
                                                    disabled={processing === u.id}
                                                >
                                                    <Button
                                                        appearance="secondary"
                                                        icon={<Dismiss24Regular />}
                                                        size="small"
                                                        disabled={processing === u.id}
                                                    >
                                                        拒绝
                                                    </Button>
                                                </ConfirmPopover>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
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

            {approvingUser && (
                <Dialog
                    open
                    onOpenChange={(_, d) => {
                        if (!d.open && !processing) setApprovingUser(null);
                    }}
                >
                    <DialogSurface style={{ maxWidth: 520 }}>
                        <DialogBody>
                            <DialogTitle>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <DataUsage24Regular />
                                    批准用户并设定初始配额: {approvingUser.username}
                                </span>
                            </DialogTitle>
                            <DialogContent>
                                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
                                    批准后将自动为该用户创建默认集控账户，并按下方设定初始化资源配额。推送通知将向用户告知允许注册的设备数量。
                                </div>
                                <div>
                                    {Object.entries(QUOTA_META).map(([key, meta]) => {
                                        const draftVal = quotaDraft[key] ?? meta.defaultMax;
                                        return (
                                            <div className="settings-item" key={key}>
                                                <div className="settings-item-info" style={{ paddingRight: 16 }}>
                                                    <div className="settings-item-label">{meta.label}</div>
                                                    <div className="settings-item-hint">{meta.hint}</div>
                                                </div>
                                                <div>
                                                    {meta.type === "boolean" ? (
                                                        <Switch
                                                            checked={Number(draftVal) >= 1}
                                                            onChange={(_, d) =>
                                                                setQuotaDraft((prev) => ({
                                                                    ...prev,
                                                                    [key]: d.checked ? 1 : 0,
                                                                }))
                                                            }
                                                        />
                                                    ) : (
                                                        <Input
                                                            type="number"
                                                            value={String(draftVal)}
                                                            onChange={(_, d) => {
                                                                const parsed = Number(d.value);
                                                                setQuotaDraft((prev) => ({
                                                                    ...prev,
                                                                    [key]: Number.isNaN(parsed) ? 0 : parsed,
                                                                }));
                                                            }}
                                                            style={{ width: 120 }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    appearance="secondary"
                                    onClick={() => setApprovingUser(null)}
                                    disabled={processing === approvingUser.id}
                                >
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    icon={<Checkmark24Regular />}
                                    onClick={handleConfirmApprove}
                                    disabled={processing === approvingUser.id}
                                >
                                    {processing === approvingUser.id ? <Spinner size="tiny" /> : "确认批准并应用配额"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
}
