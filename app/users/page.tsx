"use client";

/**
 * MINI ClassIsland 超级管理平台 — 全局用户管理页面。
 * 支持：搜索用户、直接创建用户、编辑角色/显示名/用户名/激活状态/建号权限、重置密码、重置2FA、删除用户。
 */

import React, { useEffect, useState, useCallback } from "react";
import { adminApi } from "@/lib/api";
import type { UserOut, UserUpdateRequest, UserRegisterRequest } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import {
    Button,
    Input,
    Spinner,
    Badge,
    Switch,
    MessageBar,
    MessageBarBody,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Label,
    Select,
} from "@fluentui/react-components";
import {
    Edit24Regular,
    Delete24Regular,
    Search24Regular,
    PersonAdd24Regular,
    ArrowReset24Regular,
    ShieldKeyhole24Regular,
} from "@fluentui/react-icons";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
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

    // 密码重置对话框
    const [resetPwdUser, setResetPwdUser] = useState<UserOut | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [resettingPwd, setResettingPwd] = useState(false);

    // 删除确认
    const [deleteUser, setDeleteUser] = useState<UserOut | null>(null);
    const [deleting, setDeleting] = useState(false);

    const limit = 20;

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = searchQuery.trim()
                ? await adminApi.searchUsers(searchQuery.trim())
                : await adminApi.listUsers(offset, limit);
            setUsers(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载用户列表失败");
        } finally {
            setLoading(false);
        }
    }, [offset, searchQuery]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

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
            setSuccessMsg(`已创建用户 ${created.username} (${created.email})`);
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
            setSuccessMsg(`已为用户 ${user.username} 禁用并重置两步验证 (2FA)`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "重置 2FA 失败");
        }
    }

    async function handleDelete() {
        if (!deleteUser) return;
        setDeleting(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.deleteUser(deleteUser.id);
            setDeleteUser(null);
            setSuccessMsg(`用户 ${deleteUser.username} 已删除`);
            await loadUsers();
        } catch (e) {
            setError(e instanceof Error ? e.message : "删除失败");
        } finally {
            setDeleting(false);
        }
    }

    function handleSearch() {
        setOffset(0);
        loadUsers();
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">全局用户管理</h1>
                    <p className="page-subtitle">管理 MINI ClassIsland 平台中所有注册用户、系统角色与安全状态</p>
                </div>
                <Button
                    appearance="primary"
                    icon={<PersonAdd24Regular />}
                    size="small"
                    onClick={() => setShowCreate(true)}
                >
                    创建用户
                </Button>
            </div>

            <div className="flex items-center gap-8 mb-16">
                <Input
                    placeholder="搜索用户名、显示名或邮箱..."
                    value={searchQuery}
                    onChange={(_, d) => setSearchQuery(d.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                    style={{ width: 320 }}
                    contentBefore={<Search24Regular />}
                />
                <Button size="small" onClick={handleSearch}>搜索</Button>
                {searchQuery && (
                    <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => { setSearchQuery(""); setOffset(0); }}
                    >
                        清除
                    </Button>
                )}
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
            ) : (
                <>
                    <div className="card">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>邮箱</th>
                                    <th>显示名</th>
                                    <th>系统角色</th>
                                    <th>建号权限</th>
                                    <th>2FA</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                                            暂无用户数据
                                        </td>
                                    </tr>
                                ) : users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500 }}>{u.username}</td>
                                        <td>{u.email}</td>
                                        <td>{u.display_name || "-"}</td>
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
                                                    title="编辑用户与权限"
                                                    onClick={() => {
                                                        setEditUser(u);
                                                        setEditForm({
                                                            username: u.username,
                                                            display_name: u.display_name,
                                                            role_code: u.role_code,
                                                            is_active: u.is_active,
                                                            can_create_account: Boolean(u.can_create_account),
                                                        });
                                                    }}
                                                />
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
                                                    <Button
                                                        appearance="subtle"
                                                        icon={<ShieldKeyhole24Regular />}
                                                        size="small"
                                                        title="重置/解绑两步验证 (2FA)"
                                                        onClick={() => handleReset2FA(u)}
                                                    />
                                                )}
                                                <Button
                                                    appearance="subtle"
                                                    icon={<Delete24Regular />}
                                                    size="small"
                                                    title="删除用户"
                                                    onClick={() => setDeleteUser(u)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!searchQuery && (
                        <div className="flex items-center gap-8 mt-16">
                            <Button
                                disabled={offset === 0}
                                onClick={() => setOffset(Math.max(0, offset - limit))}
                                size="small"
                            >
                                上一页
                            </Button>
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                第 {offset / limit + 1} 页
                            </span>
                            <Button
                                disabled={users.length < limit}
                                onClick={() => setOffset(offset + limit)}
                                size="small"
                            >
                                下一页
                            </Button>
                        </div>
                    )}
                </>
            )}

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
                                        placeholder="user@example.com"
                                        value={createForm.email}
                                        onChange={(_, d) => setCreateForm({ ...createForm, email: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>登录密码 * (至少 12 位，含大小写字母与数字)</Label>
                                    <Input
                                        type="password"
                                        placeholder="请输入符合复杂度要求的初始密码"
                                        value={createForm.password}
                                        onChange={(_, d) => setCreateForm({ ...createForm, password: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="grid-2">
                                    <div className="form-group">
                                        <Label>用户名 (可选，留空自动取邮箱前缀)</Label>
                                        <Input
                                            placeholder="username"
                                            value={createForm.username || ""}
                                            onChange={(_, d) => setCreateForm({ ...createForm, username: d.value })}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <Label>显示名</Label>
                                        <Input
                                            placeholder="用户昵称"
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
                                            <option key={code} value={code}>{label} ({code})</option>
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
                                    <Label>用户名</Label>
                                    <Input
                                        value={editForm.username || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, username: d.value })}
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
                                    <Label>系统角色</Label>
                                    <Select
                                        value={editForm.role_code || "normal"}
                                        onChange={(_, d) => setEditForm({ ...editForm, role_code: d.value })}
                                    >
                                        {Object.entries(ROLE_LABELS).map(([code, label]) => (
                                            <option key={code} value={code}>{label} ({code})</option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>账号启用状态</Label>
                                        <div className="form-hint">禁用后该用户无法登录或访问任何 API</div>
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
                                    <Label>新密码 (至少 12 位，包含大小写字母和数字)</Label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(_, d) => setNewPassword(d.value)}
                                        placeholder="请输入符合复杂度要求的新密码"
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

            {/* 删除确认对话框 */}
            {deleteUser && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setDeleteUser(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>确认删除用户</DialogTitle>
                            <DialogContent>
                                <p>
                                    确定要删除用户 <strong>{deleteUser.username}</strong>（{deleteUser.email}）吗？
                                    此操作不可撤销。
                                </p>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setDeleteUser(null)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    style={{ background: "var(--danger-color)" }}
                                >
                                    {deleting ? <Spinner size="tiny" /> : "确认删除"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
}
