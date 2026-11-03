"use client";

/**
 * MINI ClassIsland 超级管理平台 — 待审核用户管理页面。
 * 调用 Admin API: GET /user/pending/list, POST /user/pending/approve/{id}, POST /user/pending/reject/{id}
 */

import React, { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import type { UserOut } from "@/lib/types";
import {
    Button,
    Spinner,
    Badge,
    MessageBar,
    MessageBarBody,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@fluentui/react-components";
import {
    Checkmark24Regular,
    Dismiss24Regular,
    PersonClock24Regular,
    ArrowClockwise24Regular,
} from "@fluentui/react-icons";

export default function PendingUsersPage() {
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [rejectUser, setRejectUser] = useState<UserOut | null>(null);

    const loadPending = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await adminApi.listPendingUsers();
            setUsers(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPending();
    }, [loadPending]);

    async function handleApprove(user: UserOut) {
        setProcessing(user.id);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.approveUser(user.id);
            setSuccessMsg(`已批准用户 ${user.username}，并为其初始化默认账户`);
            await loadPending();
        } catch (e) {
            setError(e instanceof Error ? e.message : "操作失败");
        } finally {
            setProcessing(null);
        }
    }

    async function handleReject() {
        if (!rejectUser) return;
        setProcessing(rejectUser.id);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.rejectUser(rejectUser.id);
            setSuccessMsg(`已拒绝用户 ${rejectUser.username} 的注册申请`);
            setRejectUser(null);
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
                    <p className="page-subtitle">审批新注册的 MINI ClassIsland 用户申请</p>
                </div>
                <Button
                    size="small"
                    appearance="secondary"
                    icon={<ArrowClockwise24Regular />}
                    onClick={loadPending}
                >
                    刷新
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

            {loading ? (
                <div className="flex items-center justify-center" style={{ height: 200 }}>
                    <Spinner size="medium" />
                </div>
            ) : users.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <PersonClock24Regular />
                        <div className="empty-state-text">当前没有待审核的注册申请</div>
                    </div>
                </div>
            ) : (
                <div className="card">
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
                            {users.map(u => (
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
                                                onClick={() => handleApprove(u)}
                                                disabled={processing === u.id}
                                            >
                                                {processing === u.id ? <Spinner size="tiny" /> : "批准激活"}
                                            </Button>
                                            <Button
                                                appearance="secondary"
                                                icon={<Dismiss24Regular />}
                                                size="small"
                                                onClick={() => setRejectUser(u)}
                                                disabled={processing === u.id}
                                            >
                                                拒绝
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {rejectUser && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setRejectUser(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>确认拒绝注册申请</DialogTitle>
                            <DialogContent>
                                <p>
                                    确定要拒绝并移除用户 <strong>{rejectUser.username}</strong>（{rejectUser.email}）的注册申请吗？
                                </p>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setRejectUser(null)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleReject}
                                    disabled={processing === rejectUser.id}
                                    style={{ background: "var(--danger-color)" }}
                                >
                                    {processing === rejectUser.id ? <Spinner size="tiny" /> : "确认拒绝"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
}
