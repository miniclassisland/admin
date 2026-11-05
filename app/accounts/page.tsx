"use client";

/**
 * MINI ClassIsland 超级管理平台 — 全局账户与配额管理页面。
 * 支持：搜索账户、创建租户账户、编辑账户属性（名称/Slug/启用状态/注册模式）、管理租户配额、删除账户。
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type {
    AccountOut,
    AccountCreateRequest,
    AccountUpdateRequest,
    QuotaOut,
    RegistrationMode,
} from "@/lib/types";
import { QUOTA_META } from "@/lib/types";
import {
    Spinner,
    Badge,
    Input,
    Button,
    Switch,
    Label,
    MessageBar,
    MessageBarBody,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@fluentui/react-components";
import { Select } from "@/components/CustomSelect";
import {
    Search24Regular,
    Add24Regular,
    Edit24Regular,
    Delete24Regular,
    DataUsage24Regular,
    Copy24Regular,
    Settings24Regular,
} from "@fluentui/react-icons";

const REG_MODE_LABELS: Record<string, string> = {
    open: "开放注册 (Open)",
    pairing: "配对码审批 (Pairing)",
    pre_reg: "预注册白名单 (Pre-Reg)",
};

export default function AdminAccountsPage() {
    const router = useRouter();
    const { switchAccount, refreshAccounts } = useAccount();
    const [accountsList, setAccountsList] = useState<AccountOut[]>([]);
    const [filtered, setFiltered] = useState<AccountOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // 创建账户对话框
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState<AccountCreateRequest>({ name: "", slug: "" });
    const [creating, setCreating] = useState(false);

    // 编辑账户对话框
    const [editAccount, setEditAccount] = useState<AccountOut | null>(null);
    const [editForm, setEditForm] = useState<AccountUpdateRequest>({});
    const [savingEdit, setSavingEdit] = useState(false);

    // 配额管理对话框
    const [quotaAccount, setQuotaAccount] = useState<AccountOut | null>(null);
    const [quotas, setQuotas] = useState<QuotaOut[]>([]);
    const [quotaDraft, setQuotaDraft] = useState<Record<string, number>>({});
    const [loadingQuotas, setLoadingQuotas] = useState(false);
    const [savingQuotas, setSavingQuotas] = useState(false);

    // 删除确认
    const [deleteTarget, setDeleteTarget] = useState<AccountOut | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFiltered(accountsList);
        } else {
            const q = searchQuery.toLowerCase();
            setFiltered(accountsList.filter(a =>
                a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
            ));
        }
    }, [searchQuery, accountsList]);

    async function loadAccounts() {
        setLoading(true);
        setError(null);
        try {
            const list = await adminApi.listAccounts();
            setAccountsList(list);
            await refreshAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载账户失败");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!createForm.name.trim()) return;
        setCreating(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const created = await adminApi.createAccount({
                name: createForm.name.trim(),
                slug: createForm.slug?.trim() || undefined,
            });
            setShowCreate(false);
            setCreateForm({ name: "", slug: "" });
            setSuccessMsg(`租户账户 "${created.name}" (${created.slug}) 已创建`);
            await loadAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "创建账户失败");
        } finally {
            setCreating(false);
        }
    }

    async function handleSaveEdit() {
        if (!editAccount) return;
        setSavingEdit(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const updated = await adminApi.updateAccount(editAccount.id, editForm);
            setEditAccount(null);
            setSuccessMsg(`账户 "${updated.name}" 已更新`);
            await loadAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新账户失败");
        } finally {
            setSavingEdit(false);
        }
    }

    async function openQuotaModal(acct: AccountOut) {
        setQuotaAccount(acct);
        setLoadingQuotas(true);
        setError(null);
        try {
            const list = await adminApi.getAccountQuotas(acct.id);
            setQuotas(list);
            const draft: Record<string, number> = {};
            for (const [k, meta] of Object.entries(QUOTA_META)) {
                draft[k] = meta.defaultMax;
            }
            for (const q of list) {
                draft[q.quota_key] = q.max_value;
            }
            setQuotaDraft(draft);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载配额失败");
        } finally {
            setLoadingQuotas(false);
        }
    }

    async function handleSaveQuotas() {
        if (!quotaAccount) return;
        setSavingQuotas(true);
        setError(null);
        setSuccessMsg(null);
        try {
            for (const [key, val] of Object.entries(quotaDraft)) {
                await adminApi.setAccountQuota(quotaAccount.id, {
                    quota_key: key,
                    max_value: Number(val),
                });
            }
            setSuccessMsg(`账户 "${quotaAccount.name}" 的资源配额已更新`);
            setQuotaAccount(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "保存配额失败");
        } finally {
            setSavingQuotas(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.deleteAccount(deleteTarget.id);
            setSuccessMsg(`租户账户 "${deleteTarget.name}" 已删除`);
            setDeleteTarget(null);
            await loadAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "删除账户失败");
        } finally {
            setDeleting(false);
        }
    }

    function copyApiKey(key: string) {
        navigator.clipboard?.writeText(key);
        setSuccessMsg("已复制完整 API Key 到剪贴板");
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">全局账户与配额管理</h1>
                    <p className="page-subtitle">管理 MINI ClassIsland 所有多租户账户、子域路由 Slug、设备注册策略与资源配额</p>
                </div>
                <Button
                    appearance="primary"
                    icon={<Add24Regular />}
                    size="small"
                    onClick={() => setShowCreate(true)}
                >
                    创建租户账户
                </Button>
            </div>

            <div className="flex items-center gap-8 mb-16">
                <Input
                    placeholder="搜索账户名称或子域 Slug..."
                    value={searchQuery}
                    onChange={(_, d) => setSearchQuery(d.value)}
                    style={{ width: 320 }}
                    contentBefore={<Search24Regular />}
                />
                {searchQuery && (
                    <Button
                        size="small"
                        appearance="subtle"
                        onClick={() => setSearchQuery("")}
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
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>租户名称</th>
                                <th>子域名 Slug</th>
                                <th>终端接入模式</th>
                                <th>API Key</th>
                                <th>状态</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                                        {searchQuery ? "未找到匹配的账户" : "暂无账户数据"}
                                    </td>
                                </tr>
                            ) : filtered.map(acct => (
                                <tr key={acct.id}>
                                    <td style={{ fontWeight: 500 }}>{acct.name}</td>
                                    <td>
                                        <span className="api-key-cell">{acct.slug}</span>
                                    </td>
                                    <td>
                                        <Badge appearance="outline" color="informative">
                                            {REG_MODE_LABELS[acct.registration_mode || "open"] || acct.registration_mode || "开放注册"}
                                        </Badge>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-4">
                                            <span className="api-key-cell">
                                                {acct.api_key.substring(0, 8)}...
                                            </span>
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Copy24Regular />}
                                                title="复制完整 API Key"
                                                onClick={() => copyApiKey(acct.api_key)}
                                            />
                                        </div>
                                    </td>
                                    <td>
                                        <Badge color={acct.is_active ? "success" : "severe"}>
                                            {acct.is_active ? "活跃" : "已停用"}
                                        </Badge>
                                    </td>
                                    <td>{new Date(acct.created_at).toLocaleDateString("zh-CN")}</td>
                                    <td>
                                        <div className="flex gap-4">
                                            <Button
                                                appearance="primary"
                                                size="small"
                                                icon={<Settings24Regular />}
                                                title="进入该租户的集控管理后台（编辑课表、时间表、科目、策略、客户端等）"
                                                onClick={() => {
                                                    switchAccount(acct.id);
                                                    router.push("/dashboard");
                                                }}
                                            >
                                                进入集控编辑
                                            </Button>
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<DataUsage24Regular />}
                                                title="配额与功能开关"
                                                onClick={() => openQuotaModal(acct)}
                                            >
                                                配额
                                            </Button>
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Edit24Regular />}
                                                title="编辑账户"
                                                onClick={() => {
                                                    setEditAccount(acct);
                                                    setEditForm({
                                                        new_id: acct.id,
                                                        name: acct.name,
                                                        slug: acct.slug,
                                                        is_active: acct.is_active,
                                                        registration_mode: (acct.registration_mode || "open") as RegistrationMode,
                                                    });
                                                }}
                                            />
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<Delete24Regular />}
                                                title="删除账户"
                                                onClick={() => setDeleteTarget(acct)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 创建租户账户对话框 */}
            {showCreate && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setShowCreate(false); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>创建租户账户</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <Label>租户名称 *</Label>
                                    <Input
                                        placeholder="例如：第一中学电教中心"
                                        value={createForm.name}
                                        onChange={(_, d) => setCreateForm({ ...createForm, name: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>子域名标识 Slug (可选，留空自动生成)</Label>
                                    <Input
                                        placeholder="例如：no1-school (仅限小写字母、数字和连字符)"
                                        value={createForm.slug || ""}
                                        onChange={(_, d) => setCreateForm({ ...createForm, slug: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                    <div className="form-hint">用于终端接入的子域名标识与多租户隔离标识</div>
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setShowCreate(false)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleCreate}
                                    disabled={creating || !createForm.name.trim()}
                                >
                                    {creating ? <Spinner size="tiny" /> : "创建"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            {/* 编辑账户对话框 */}
            {editAccount && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setEditAccount(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>编辑租户账户: {editAccount.name}</DialogTitle>
                            <DialogContent>
                                <div className="form-group">
                                    <Label>账户 ID (唯一标识)</Label>
                                    <Input
                                        value={editForm.new_id ?? editAccount.id}
                                        onChange={(_, d) => setEditForm({ ...editForm, new_id: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                    <div className="form-hint">3-64 位字母、数字、连字符或下划线，修改后将自动同步关联数据</div>
                                </div>
                                <div className="form-group">
                                    <Label>租户名称</Label>
                                    <Input
                                        value={editForm.name || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, name: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>子域名 Slug</Label>
                                    <Input
                                        value={editForm.slug || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, slug: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>终端默认注册接入模式</Label>
                                    <Select
                                        value={editForm.registration_mode || "open"}
                                        onChange={(_, d) => setEditForm({ ...editForm, registration_mode: d.value as RegistrationMode })}
                                    >
                                        <option value="open">开放注册 (Open) — 终端连接即自动接入</option>
                                        <option value="pairing">配对码审批 (Pairing) — 终端生成 6 位配对码由管理员确认</option>
                                        <option value="pre_reg">预注册白名单 (Pre-Reg) — 仅允许后台登记的标识或 MAC 接入</option>
                                    </Select>
                                </div>
                                <div className="form-group flex items-center justify-between">
                                    <div>
                                        <Label style={{ marginBottom: 0 }}>账户启用状态</Label>
                                        <div className="form-hint">停用后该租户下的所有终端将暂停同步</div>
                                    </div>
                                    <Switch
                                        checked={Boolean(editForm.is_active)}
                                        onChange={(_, d) => setEditForm({ ...editForm, is_active: d.checked })}
                                    />
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setEditAccount(null)}>
                                    取消
                                </Button>
                                <Button appearance="primary" onClick={handleSaveEdit} disabled={savingEdit}>
                                    {savingEdit ? <Spinner size="tiny" /> : "保存更改"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            {/* 配额管理对话框 */}
            {quotaAccount && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setQuotaAccount(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>资源配额与功能控制: {quotaAccount.name}</DialogTitle>
                            <DialogContent>
                                {loadingQuotas ? (
                                    <div className="flex items-center justify-center" style={{ height: 120 }}>
                                        <Spinner size="small" label="读取配额中..." />
                                    </div>
                                ) : (
                                    <div>
                                        {Object.entries(QUOTA_META).map(([key, meta]) => {
                                            const existing = quotas.find(q => q.quota_key === key);
                                            const currentVal = existing?.current_value ?? 0;
                                            const draftVal = quotaDraft[key] ?? meta.defaultMax;

                                            return (
                                                <div className="settings-item" key={key}>
                                                    <div className="settings-item-info" style={{ paddingRight: 16 }}>
                                                        <div className="settings-item-label">{meta.label}</div>
                                                        <div className="settings-item-hint">
                                                            {meta.hint}
                                                            {meta.type === "number" && (
                                                                <span style={{ marginLeft: 8, color: "var(--accent-color)", fontWeight: 500 }}>
                                                                    (当前已用: {currentVal})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {meta.type === "boolean" ? (
                                                            <Switch
                                                                checked={Number(draftVal) >= 1}
                                                                onChange={(_, d) =>
                                                                    setQuotaDraft(prev => ({ ...prev, [key]: d.checked ? 1 : 0 }))
                                                                }
                                                            />
                                                        ) : (
                                                            <Input
                                                                type="number"
                                                                value={String(draftVal)}
                                                                onChange={(_, d) => {
                                                                    const parsed = Number(d.value);
                                                                    setQuotaDraft(prev => ({
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
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setQuotaAccount(null)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleSaveQuotas}
                                    disabled={loadingQuotas || savingQuotas}
                                >
                                    {savingQuotas ? <Spinner size="tiny" /> : "保存配额"}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            {/* 删除确认对话框 */}
            {deleteTarget && (
                <Dialog open onOpenChange={(_, d) => { if (!d.open) setDeleteTarget(null); }}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>确认删除租户账户</DialogTitle>
                            <DialogContent>
                                <p>
                                    确定要删除租户账户 <strong>{deleteTarget.name}</strong>（<code>{deleteTarget.slug}</code>）吗？
                                    该账户的成员绑定、配额与预注册设备白名单将一并清理，此操作不可撤销。
                                </p>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setDeleteTarget(null)}>
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
