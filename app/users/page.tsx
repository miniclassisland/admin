"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { adminApi } from "@/lib/api";
import type { UserOut, UserUpdateRequest, UserRegisterRequest } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Button,
    Input,
    Spinner,
    Badge,
    Switch,
    Popover,
    PopoverTrigger,
    PopoverSurface,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Label,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Edit24Regular,
    Delete24Regular,
    Search24Regular,
    PersonAdd24Regular,
    ArrowReset24Regular,
    ShieldKeyhole24Regular,
    LinkDismiss24Regular,
    Filter16Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
    ArrowClockwise24Regular,
} from "@fluentui/react-icons";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // 创建用户对话框
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState<UserRegisterRequest>({
        email: "",
        password: "",
        username: "",
        display_name: "",
        role_code: "normal",
        can_create_account: true,
    });
    const [creating, setCreating] = useState(false);

    // 编辑用户对话框
    const [editUser, setEditUser] = useState<UserOut | null>(null);
    const [editForm, setEditForm] = useState<UserUpdateRequest>({});
    const [saving, setSaving] = useState(false);
    const [unbindingQQ, setUnbindingQQ] = useState(false);

    // 密码重置对话框
    const [resetPwdUser, setResetPwdUser] = useState<UserOut | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [resettingPwd, setResettingPwd] = useState(false);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await adminApi.listUsers(0, 500);
            setUsers(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载用户列表失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            if (roleFilter !== "all" && u.role_code !== roleFilter) return false;
            if (statusFilter === "active" && !u.is_active) return false;
            if (statusFilter === "inactive" && u.is_active) return false;
            return matchAdvancedQuery(u, searchQuery, {
                fields: {
                    role: (item) => [item.role_code, ROLE_LABELS[item.role_code] || ""],
                    status: (item) => (item.is_active ? "active" : "inactive"),
                    totp: (item) => Boolean(item.totp_enabled),
                    qq: (item) => item.bound_qq || "",
                    name: (item) => [item.username, item.display_name || ""],
                    email: (item) => item.email,
                    id: (item) => item.id,
                },
                freeText: (item) => [
                    item.username,
                    item.email,
                    item.display_name,
                    item.bound_qq,
                    item.id,
                    ROLE_LABELS[item.role_code] || item.role_code,
                ],
            });
        });
    }, [users, roleFilter, statusFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

    async function handleCreate() {
        if (!createForm.email.trim() || createForm.password.length < 12) return;
        setCreating(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const created = await adminApi.createUser({
                email: createForm.email.trim(),
                password: createForm.password,
                username: createForm.username?.trim() || undefined,
                display_name: createForm.display_name?.trim() || undefined,
                role_code: createForm.role_code || "normal",
                can_create_account: createForm.can_create_account,
            });
            setShowCreate(false);
            setCreateForm({
                email: "",
                password: "",
                username: "",
                display_name: "",
                role_code: "normal",
                can_create_account: true,
            });
            setSuccessMsg(`已创建用户 ${created.username}`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "创建用户失败");
        } finally {
            setCreating(false);
        }
    }

    async function handleSave() {
        if (!editUser) return;
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.updateUser(editUser.id, editForm);
            setEditUser(null);
            setSuccessMsg(`用户 ${editUser.username} 信息已更新`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新失败");
        } finally {
            setSaving(false);
        }
    }

    async function handleUnbindQQ(target: UserOut) {
        setUnbindingQQ(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const updated = await adminApi.unbindUserQQ(target.id);
            if (editUser && editUser.id === target.id) {
                setEditUser(updated);
                setEditForm((prev) => ({ ...prev, qq_uin: "" }));
            }
            setSuccessMsg(`已解绑用户 ${target.username} 的 QQ 并通知机器人移出群聊`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "解绑 QQ 失败");
        } finally {
            setUnbindingQQ(false);
        }
    }

    async function handleResetPassword() {
        if (!resetPwdUser || newPassword.length < 12) return;
        setResettingPwd(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.resetPassword(resetPwdUser.id, { new_password: newPassword });
            setResetPwdUser(null);
            setNewPassword("");
            setSuccessMsg(`用户 ${resetPwdUser.username} 的密码已重置`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "重置密码失败");
        } finally {
            setResettingPwd(false);
        }
    }

    async function handleReset2FA(user: UserOut) {
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.disable2FA(user.id);
            setSuccessMsg(`已为用户 ${user.username} 禁用并重置两步验证`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "重置两步验证失败");
        }
    }

    async function handleDelete(target: UserOut) {
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.deleteUser(target.id);
            setSuccessMsg(`用户 ${target.username} 已删除`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "删除失败");
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">全局用户管理</h1>
                    <p className="page-subtitle">管理 MINI ClassIsland 平台中所有注册用户、系统角色、QQ 绑定与安全状态</p>
                </div>
                <div className="flex gap-8">
                    <Button
                        appearance="secondary"
                        icon={<ArrowClockwise24Regular />}
                        onClick={loadUsers}
                    >
                        刷新列表
                    </Button>
                    <Button
                        appearance="primary"
                        icon={<PersonAdd24Regular />}
                        onClick={() => setShowCreate(true)}
                    >
                        创建用户
                    </Button>
                </div>
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
                            placeholder="搜索用户名、显示名、邮箱、QQ 号或高级过滤表达式"
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
                            <PopoverSurface style={{ padding: 12, width: 290 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>系统角色筛选</div>
                                    <Select
                                        size="small"
                                        value={roleFilter}
                                        onChange={(_, d) => {
                                            setRoleFilter(d.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部角色</option>
                                        {Object.entries(ROLE_LABELS).map(([code, label]) => (
                                            <option key={code} value={code}>{label}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>状态筛选</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as typeof statusFilter);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部状态</option>
                                        <option value="active">活跃</option>
                                        <option value="inactive">已禁用</option>
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
                        <span>{users.length}位平台用户</span>
                        <span>{filteredUsers.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : pagedUsers.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的用户数据</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>邮箱</th>
                                    <th>显示名</th>
                                    <th>绑定 QQ</th>
                                    <th>系统角色</th>
                                    <th>建号权限</th>
                                    <th>两步验证</th>
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
                                        <td>
                                            {u.bound_qq ? (
                                                <div className="flex items-center gap-4" style={{ flexWrap: "wrap" }}>
                                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                                                        {u.bound_qq}
                                                    </span>
                                                    <Badge
                                                        appearance="tint"
                                                        color={u.qq_joined_group === false ? "warning" : "success"}
                                                    >
                                                        {u.qq_joined_group === false ? "待入群" : "已入群"}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>未绑定</span>
                                            )}
                                        </td>
                                        <td>
                                            <Badge
                                                appearance="filled"
                                                color={
                                                    u.role_code === "superadmin"
                                                        ? "danger"
                                                        : u.role_code === "admin"
                                                            ? "warning"
                                                            : u.role_code === "banned"
                                                                ? "severe"
                                                                : "informative"
                                                }
                                            >
                                                {ROLE_LABELS[u.role_code] || u.role_code}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge appearance="outline" color={u.can_create_account ? "success" : "subtle"}>
                                                {u.can_create_account ? "允许创建租户" : "仅受邀"}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge appearance="tint" color={u.totp_enabled ? "success" : "subtle"}>
                                                {u.totp_enabled ? "已开启" : "未开启"}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge color={u.is_active ? "success" : "severe"}>
                                                {u.is_active ? "活跃" : "已禁用"}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="flex gap-4">
                                                <Button
                                                    appearance="subtle"
                                                    icon={<Edit24Regular />}
                                                    size="small"
                                                    title="编辑用户与 QQ 绑定"
                                                    onClick={() => {
                                                        setEditUser(u);
                                                        setEditForm({
                                                            username: u.username,
                                                            email: u.email,
                                                            display_name: u.display_name,
                                                            role_code: u.role_code,
                                                            is_active: u.is_active,
                                                            can_create_account: Boolean(u.can_create_account),
                                                            totp_enabled: Boolean(u.totp_enabled),
                                                            qq_uin: u.bound_qq || "",
                                                        });
                                                    }}
                                                />
                                                {u.bound_qq && (
                                                    <ConfirmPopover
                                                        message={`确定要解绑用户「${u.username}」的 QQ 并通知机器人移出群聊吗？`}
                                                        onConfirm={() => handleUnbindQQ(u)}
                                                        confirmText="解绑"
                                                        disabled={unbindingQQ}
                                                    >
                                                        <Button
                                                            appearance="subtle"
                                                            icon={<LinkDismiss24Regular />}
                                                            size="small"
                                                            title="解绑 QQ 并移出群聊"
                                                            disabled={unbindingQQ}
                                                        />
                                                    </ConfirmPopover>
                                                )}
                                                <Button
                                                    appearance="subtle"
                                                    icon={<ArrowReset24Regular />}
                                                    size="small"
                                                    title="重置登录密码"
                                                    onClick={() => {
                                                        setResetPwdUser(u);
                                                        setNewPassword("");
                                                    }}
                                                />
                                                {u.totp_enabled && (
                                                    <ConfirmPopover
                                                        message={`确定要重置并解绑用户「${u.username}」的两步验证吗？`}
                                                        onConfirm={() => handleReset2FA(u)}
                                                        confirmText="重置"
                                                    >
                                                        <Button
                                                            appearance="subtle"
                                                            icon={<ShieldKeyhole24Regular />}
                                                            size="small"
                                                            title="重置两步验证"
                                                        />
                                                    </ConfirmPopover>
                                                )}
                                                <ConfirmPopover
                                                    message={`确定要删除用户「${u.username}」吗？此操作不可撤销。`}
                                                    onConfirm={() => handleDelete(u)}
                                                    confirmText="删除"
                                                >
                                                    <Button
                                                        appearance="subtle"
                                                        icon={<Delete24Regular />}
                                                        size="small"
                                                        title="删除用户"
                                                        style={{ color: "var(--danger-color)" }}
                                                    />
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

            {/* 创建用户对话框 */}
            {showCreate && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setShowCreate(false); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>创建平台用户</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <Label>邮箱 *</Label>
                                    <Input
                                        type="email"
                                        placeholder="输入邮箱地址"
                                        value={createForm.email}
                                        onChange={(_, d) => setCreateForm({ ...createForm, email: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>登录密码 *（至少 12 位，含大小写字母与数字）</Label>
                                    <Input
                                        type="password"
                                        placeholder="输入符合复杂度要求的初始密码"
                                        value={createForm.password}
                                        onChange={(_, d) => setCreateForm({ ...createForm, password: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <Label>用户名（可选，留空随机生成）</Label>
                                        <Input
                                            placeholder="留空自动生成随机用户名"
                                            value={createForm.username || ""}
                                            onChange={(_, d) => setCreateForm({ ...createForm, username: d.value })}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <Label>显示名</Label>
                                        <Input
                                            placeholder="输入用户昵称"
                                            value={createForm.display_name || ""}
                                            onChange={(_, d) => setCreateForm({ ...createForm, display_name: d.value })}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <Label>系统角色</Label>
                                    <Select
                                        value={createForm.role_code || "normal"}
                                        onChange={(_, d) => setCreateForm({ ...createForm, role_code: d.value })}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([code, label]) => (
                                            <option key={code} value={code}>{label}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>允许自助创建多租户账户</Label>
                                        <div className="form-hint">开启后该用户可在主面板创建新的集控租户</div>
                                    </div>
                                    <Switch
                                        checked={Boolean(createForm.can_create_account)}
                                        onChange={(_, d) => setCreateForm({ ...createForm, can_create_account: d.checked })}
                                    />
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setShowCreate(false)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleCreate}
                                    disabled={creating || !createForm.email.trim() || createForm.password.length < 12}
                                >
                                    {creating ? <Spinner size="tiny" /> : "创建用户"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            {/* 编辑用户对话框 */}
            {editUser && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setEditUser(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>编辑用户: {editUser.username}</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <Label>用户 ID</Label>
                                    <Input
                                        value={editUser.id}
                                        readOnly
                                        disabled
                                        style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>用户名</Label>
                                    <Input
                                        value={editForm.username || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, username: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>绑定邮箱</Label>
                                    <Input
                                        type="email"
                                        value={editForm.email || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, email: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>显示名</Label>
                                    <Input
                                        value={editForm.display_name || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, display_name: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>绑定 QQ 号</Label>
                                    <div className="flex items-center gap-8">
                                        <Input
                                            placeholder="输入 5-20 位 QQ 号，留空保存将解绑"
                                            value={editForm.qq_uin ?? ""}
                                            onChange={(_, d) => setEditForm({ ...editForm, qq_uin: d.value })}
                                            style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                                        />
                                        {editUser.bound_qq && (
                                            <Button
                                                size="small"
                                                appearance="secondary"
                                                icon={<LinkDismiss24Regular />}
                                                disabled={unbindingQQ}
                                                onClick={() => void handleUnbindQQ(editUser)}
                                            >
                                                立即解绑
                                            </Button>
                                        )}
                                    </div>
                                    <div className="form-hint">
                                        支持绑定、换绑或留空解绑
                                    </div>
                                </div>
                                <div className="form-group">
                                    <Label>系统角色</Label>
                                    <Select
                                        value={editForm.role_code || "normal"}
                                        onChange={(_, d) => setEditForm({ ...editForm, role_code: d.value })}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([code, label]) => (
                                            <option key={code} value={code}>{label}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>账号启用状态</Label>
                                        <div className="form-hint">禁用后该用户无法登录或访问任何接口</div>
                                    </div>
                                    <Switch
                                        checked={Boolean(editForm.is_active)}
                                        onChange={(_, d) => setEditForm({ ...editForm, is_active: d.checked })}
                                    />
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>允许创建租户账户</Label>
                                        <div className="form-hint">授权该用户在主面板创建新的独立租户账户</div>
                                    </div>
                                    <Switch
                                        checked={Boolean(editForm.can_create_account)}
                                        onChange={(_, d) => setEditForm({ ...editForm, can_create_account: d.checked })}
                                    />
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>两步验证状态</Label>
                                        <div className="form-hint">关闭将清除该用户的两步验证绑定与恢复码</div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        {editForm.totp_enabled && (
                                            <Button
                                                size="small"
                                                appearance="secondary"
                                                icon={<ShieldKeyhole24Regular />}
                                                onClick={() => {
                                                    setEditForm({ ...editForm, totp_enabled: false });
                                                }}
                                            >
                                                重置两步验证
                                            </Button>
                                        )}
                                        <Switch
                                            checked={Boolean(editForm.totp_enabled)}
                                            onChange={(_, d) => setEditForm({ ...editForm, totp_enabled: d.checked })}
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setEditUser(null)}>
                                    取消
                                </Button>
                                <Button appearance="primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <Spinner size="tiny" /> : "保存更改"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            {/* 重置密码对话框 */}
            {resetPwdUser && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setResetPwdUser(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>重置密码: {resetPwdUser.username}</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <Label>新密码（至少 12 位，包含大小写字母和数字）</Label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(_, d) => setNewPassword(d.value)}
                                        placeholder="输入符合复杂度要求的新密码"
                                        style={{ width: "100%" }}
                                    />
                                    <div className="form-hint">超级管理员直接重置密码，无需原密码验证</div>
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setResetPwdUser(null)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleResetPassword}
                                    disabled={resettingPwd || newPassword.length < 12}
                                >
                                    {resettingPwd ? <Spinner size="tiny" /> : "确认重置"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
}
