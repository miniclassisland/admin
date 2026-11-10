"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Spinner,
    Badge,
    Input,
    Button,
    Switch,
    Label,
    Popover,
    PopoverTrigger,
    PopoverSurface,
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
    Search24Regular,
    Add24Regular,
    Edit24Regular,
    Delete24Regular,
    DataUsage24Regular,
    Copy24Regular,
    Settings24Regular,
    Filter16Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
} from "@fluentui/react-icons";

const REG_MODE_LABELS: Record<string, string> = {
    open: "开放注册",
    pairing: "配对码审批",
    pre_reg: "预注册白名单",
};

export default function AdminAccountsPage() {
    const router = useRouter();
    const { switchAccount, refreshAccounts } = useAccount();
    const [accountsList, setAccountsList] = useState<AccountOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [modeFilter, setModeFilter] = useState<string>("all");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

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

    useEffect(() => {
        loadAccounts();
    }, []);

    async function loadAccounts() {
        setLoading(true);
        setError(null);
        try {
            const list = await adminApi.listAccounts();
            setAccountsList(Array.isArray(list) ? list : []);
            await refreshAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载账户失败");
        } finally {
            setLoading(false);
        }
    }

    const filteredAccounts = useMemo(() => {
        return accountsList.filter((a) => {
            if (statusFilter === "active" && !a.is_active) return false;
            if (statusFilter === "inactive" && a.is_active) return false;
            const regMode = a.registration_mode || "pairing";
            if (modeFilter !== "all" && regMode !== modeFilter) return false;
            return matchAdvancedQuery(a, searchQuery, {
                fields: {
                    status: (item) => (item.is_active ? "active" : "inactive"),
                    mode: (item) => [item.registration_mode || "pairing", REG_MODE_LABELS[item.registration_mode || "pairing"] || ""],
                    name: (item) => item.name,
                    slug: (item) => item.slug,
                    id: (item) => item.id,
                },
                freeText: (item) => [
                    item.name,
                    item.slug,
                    item.id,
                    REG_MODE_LABELS[item.registration_mode || "pairing"],
                ],
            });
        });
    }, [accountsList, statusFilter, modeFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedAccounts = filteredAccounts.slice((safePage - 1) * pageSize, safePage * pageSize);

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
            setSuccessMsg(`租户账户 "${created.name}" 已创建`);
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

    async function handleDelete(acct: AccountOut) {
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.deleteAccount(acct.id);
            setSuccessMsg(`租户账户 "${acct.name}" 已删除`);
            await loadAccounts();
        } catch (e) {
            setError(e instanceof Error ? e.message : "删除账户失败");
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
                    <p className="page-subtitle">管理 MINI ClassIsland 所有多租户账户、子域路由标识、设备注册策略与资源配额</p>
                </div>
                <Button
                    appearance="primary"
                    icon={<Add24Regular />}
                    onClick={() => setShowCreate(true)}
                >
                    创建租户账户
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
                            placeholder="搜索账户名称、子域标识或高级过滤表达式"
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
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>状态筛选</div>
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
                                        <option value="inactive">已停用</option>
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>终端接入模式</div>
                                    <Select
                                        size="small"
                                        value={modeFilter}
                                        onChange={(_, d) => {
                                            setModeFilter(d.value);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="all">全部模式</option>
                                        {Object.entries(REG_MODE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
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
                        <span>{accountsList.length}个租户账户</span>
                        <span>{filteredAccounts.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : pagedAccounts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">
                                {searchQuery ? "未找到匹配的账户" : "暂无账户数据"}
                            </div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>租户名称</th>
                                    <th>子域名标识</th>
                                    <th>终端接入模式</th>
                                    <th>API Key</th>
                                    <th>状态</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedAccounts.map((acct) => (
                                    <tr key={acct.id}>
                                        <td style={{ fontWeight: 500 }}>{acct.name}</td>
                                        <td>
                                            <span className="api-key-cell">{acct.slug}</span>
                                        </td>
                                        <td>
                                            <Badge appearance="outline" color="informative">
                                                {REG_MODE_LABELS[acct.registration_mode || "pairing"] || acct.registration_mode || "配对码审批"}
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
                                                    title="进入该租户的集控管理后台"
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
                                                            name: acct.name,
                                                            slug: acct.slug,
                                                            is_active: acct.is_active,
                                                            registration_mode: (acct.registration_mode || "pairing") as RegistrationMode,
                                                        });
                                                    }}
                                                />
                                                <ConfirmPopover
                                                    message={`确定要删除租户账户「${acct.name}」吗？该账户的成员绑定、配额与预注册设备白名单将一并清理。`}
                                                    onConfirm={() => handleDelete(acct)}
                                                    confirmText="删除"
                                                >
                                                    <Button
                                                        appearance="subtle"
                                                        size="small"
                                                        icon={<Delete24Regular />}
                                                        title="删除账户"
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
                                        placeholder="输入组织或学校名称"
                                        value={createForm.name}
                                        onChange={(_, d) => setCreateForm({ ...createForm, name: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>子域名标识（可选，留空自动随机生成）</Label>
                                    <Input
                                        placeholder="留空自动生成随机子域标识"
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
                                    <Label>账户 ID</Label>
                                    <Input
                                        value={editAccount.id}
                                        readOnly
                                        disabled
                                        style={{ width: "100%", fontFamily: "var(--font-mono)" }}
                                    />
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
                                    <Label>子域名标识</Label>
                                    <Input
                                        value={editForm.slug || ""}
                                        onChange={(_, d) => setEditForm({ ...editForm, slug: d.value })}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="form-group">
                                    <Label>终端默认注册接入模式</Label>
                                    <Select
                                        value={editForm.registration_mode || "pairing"}
                                        onChange={(_, d) => setEditForm({ ...editForm, registration_mode: d.value as RegistrationMode })}
                                    >
                                        <option value="open">开放注册 — 终端连接即自动接入</option>
                                        <option value="pairing">配对码审批 — 终端生成 6 位配对码由管理员确认</option>
                                        <option value="pre_reg">预注册白名单 — 仅允许后台登记的标识或 MAC 接入</option>
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
                                                                    当前已用: {currentVal}
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
        </div>
    );
}
