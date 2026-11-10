"use client";

import React, { useState, useEffect, useCallback } from "react";
import { accounts, adminApi } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import type { AccountOut, SlugUpdate, QuotaOut, RegistrationMode } from "@/lib/types";
import { REGISTRATION_MODE_LABELS, QUOTA_META } from "@/lib/types";
import {
    Button, Input, Spinner, Switch,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import { ConfirmPopover } from "@/components/ConfirmPopover";
import {
    Edit24Regular, Delete24Regular, ArrowClockwise24Regular, Copy24Regular, Save24Regular,
} from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import DownloadPresetPopoverButton from "@/components/DownloadPresetPopoverButton";

export default function TenantAccountPage() {
    const { accountId, currentAccount, refreshAccounts } = useAccount();
    const router = useRouter();
    const [accountInfo, setAccountInfo] = useState<AccountOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [editingSlug, setEditingSlug] = useState(false);
    const [newSlug, setNewSlug] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleting, setDeleting] = useState(false);

    // 配额管理
    const [quotas, setQuotas] = useState<QuotaOut[]>([]);
    const [quotaDraft, setQuotaDraft] = useState<Record<string, number>>({});
    const [savingQuotas, setSavingQuotas] = useState(false);

    const loadData = useCallback(async () => {
        if (!accountId) return;
        setLoading(true);
        try {
            const [info, qList] = await Promise.all([
                accounts.info(accountId),
                adminApi.getAccountQuotas(accountId),
            ]);
            setAccountInfo(info);
            setQuotas(qList);
            const draft: Record<string, number> = {};
            for (const [k, meta] of Object.entries(QUOTA_META)) {
                draft[k] = meta.defaultMax;
            }
            for (const q of qList) {
                draft[q.quota_key] = q.max_value;
            }
            setQuotaDraft(draft);
        } catch {
            setAccountInfo(currentAccount);
        }
        setLoading(false);
    }, [accountId, currentAccount]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    async function handleNameChange(e: React.FormEvent) {
        e.preventDefault();
        if (!accountId || !newName.trim()) return;
        setSaving(true);
        setMsg(null);
        try {
            const updated = await adminApi.updateAccount(accountId, { name: newName.trim() });
            setAccountInfo(updated);
            setEditingName(false);
            setMsg({ type: "success", text: "租户名称已更新" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleSlugChange(e: React.FormEvent) {
        e.preventDefault();
        if (!accountId || !newSlug.trim()) return;
        setSaving(true);
        setMsg(null);
        try {
            const payload: SlugUpdate = { slug: newSlug.trim() };
            const updated = await adminApi.updateAccount(accountId, payload);
            setAccountInfo(updated);
            setEditingSlug(false);
            setMsg({ type: "success", text: "租户 Slug 已更新" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleRegModeChange(mode: RegistrationMode) {
        if (!accountId) return;
        setSaving(true);
        try {
            const updated = await adminApi.updateAccount(accountId, { registration_mode: mode });
            setAccountInfo(updated);
            setMsg({ type: "success", text: `终端接入策略已切换为：${REGISTRATION_MODE_LABELS[mode]}` });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleToggleActive(nextActive: boolean) {
        if (!accountId) return;
        setSaving(true);
        try {
            const updated = await adminApi.updateAccount(accountId, { is_active: nextActive });
            setAccountInfo(updated);
            setMsg({ type: "success", text: `租户账户状态已更新为：${nextActive ? "活跃" : "已停用"}` });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
        }
        setSaving(false);
    }

    async function handleRegenerateApiKey() {
        if (!accountId) return;
        setSaving(true);
        try {
            const updated = await accounts.regenerateApiKey(accountId);
            setAccountInfo(updated);
            setMsg({ type: "success", text: "API Key 已重新生成" });
            refreshAccounts();
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "重置失败" });
        }
        setSaving(false);
    }

    async function handleSaveQuotas() {
        if (!accountId) return;
        setSavingQuotas(true);
        setMsg(null);
        try {
            for (const [key, val] of Object.entries(quotaDraft)) {
                await adminApi.setAccountQuota(accountId, {
                    quota_key: key,
                    max_value: Number(val),
                });
            }
            const refreshed = await adminApi.getAccountQuotas(accountId);
            setQuotas(refreshed);
            setMsg({ type: "success", text: "租户设备配额与功能开关已保存生效" });
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "保存配额失败" });
        }
        setSavingQuotas(false);
    }

    async function handleDeleteAccount() {
        if (!accountInfo || deleteConfirm !== accountInfo.name) return;
        setDeleting(true);
        try {
            await adminApi.deleteAccount(accountId);
            setMsg({ type: "success", text: "账户已删除" });
            await refreshAccounts();
            router.push("/accounts");
        } catch (err: unknown) {
            setMsg({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
            setDeleting(false);
        }
    }

    const slugName = accountInfo?.slug || currentAccount?.slug || "account";

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">租户概览与配额控制</h1>
                    <p className="page-subtitle">超管直管当前租户基本信息、引导文件下载、允许注册设备数及允许 gRPC 长连接设备数</p>
                </div>
                <DownloadPresetPopoverButton
                    buttonText="下载通用配置"
                    appearance="primary"
                    defaultFileName={`ManagementPreset-${slugName}-generic.json`}
                    onFetchData={() => accounts.downloadPreset(accountId)}
                    onError={(text) => setMsg({ type: "error", text })}
                />
            </div>

            {msg && (
                <MessageBar intent={msg.type} style={{ marginBottom: 16 }}>
                    <MessageBarBody>{msg.text}</MessageBarBody>
                </MessageBar>
            )}

            <div className="card">
                <div className="card-title">租户基础属性</div>
                {loading ? (
                    <div className="empty-state"><Spinner size="medium" /></div>
                ) : !accountInfo ? (
                    <div className="empty-state"><div className="empty-state-text">暂无账户数据</div></div>
                ) : (
                    <div style={{ display: "grid", gap: 20 }}>
                        <div className="detail-row">
                            <div className="detail-label">账户名称</div>
                            <div className="detail-value">
                                {editingName ? (
                                    <form onSubmit={handleNameChange} className="flex items-center gap-8">
                                        <Input
                                            value={newName}
                                            onChange={(_, d) => setNewName(d.value)}
                                            placeholder="输入账户/学校名称"
                                            size="small"
                                        />
                                        <Button appearance="primary" size="small" type="submit" disabled={saving || !newName.trim()}>
                                            保存
                                        </Button>
                                        <Button appearance="subtle" size="small" onClick={() => setEditingName(false)}>
                                            取消
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="flex items-center gap-8">
                                        <strong style={{ fontSize: 15 }}>{accountInfo.name}</strong>
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Edit24Regular />}
                                            onClick={() => {
                                                setNewName(accountInfo.name);
                                                setEditingName(true);
                                            }}
                                        >
                                            修改名称
                                        </Button>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">账户 ID</div>
                            <div className="detail-value">
                                <span className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                    <Input
                                        value={accountInfo.id}
                                        readOnly
                                        size="small"
                                        style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                    />
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Copy24Regular />}
                                        onClick={() => {
                                            navigator.clipboard.writeText(accountInfo.id);
                                            setMsg({ type: "success", text: "账户 ID 已复制到剪贴板" });
                                        }}
                                    >
                                        复制
                                    </Button>
                                </span>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">子域名标识</div>
                            <div className="detail-value">
                                {editingSlug ? (
                                    <form onSubmit={handleSlugChange} className="flex items-center gap-8">
                                        <Input
                                            value={newSlug}
                                            onChange={(_, d) => setNewSlug(d.value)}
                                            placeholder="3-64 位小写字母/数字/连字符/下划线"
                                            size="small"
                                            style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                        />
                                        <Button appearance="primary" size="small" type="submit" disabled={saving || !newSlug.trim()}>
                                            保存
                                        </Button>
                                        <Button appearance="subtle" size="small" onClick={() => setEditingSlug(false)}>
                                            取消
                                        </Button>
                                    </form>
                                ) : (
                                    <span className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                        <Input
                                            value={accountInfo.slug}
                                            readOnly
                                            size="small"
                                            style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                        />
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Edit24Regular />}
                                            onClick={() => {
                                                setNewSlug(accountInfo.slug);
                                                setEditingSlug(true);
                                            }}
                                        >
                                            修改标识
                                        </Button>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">API Key</div>
                            <div className="detail-value flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                <Input
                                    value={accountInfo.api_key}
                                    readOnly
                                    size="small"
                                    style={{ minWidth: 320, fontFamily: "var(--font-mono)" }}
                                />
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Copy24Regular />}
                                    onClick={() => {
                                        navigator.clipboard.writeText(accountInfo.api_key);
                                        setMsg({ type: "success", text: "API Key 已复制到剪贴板" });
                                    }}
                                >
                                    复制
                                </Button>
                                <ConfirmPopover
                                    message="确定要重置 API Key 吗？旧 API Key 将立即失效。"
                                    onConfirm={handleRegenerateApiKey}
                                    confirmText="重新生成"
                                    disabled={saving}
                                >
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<ArrowClockwise24Regular />}
                                        disabled={saving}
                                    >
                                        重新生成
                                    </Button>
                                </ConfirmPopover>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">终端接入策略</div>
                            <div className="detail-value">
                                <Select
                                    size="small"
                                    value={accountInfo.registration_mode || "pairing"}
                                    onChange={(_, d) => handleRegModeChange(d.value as RegistrationMode)}
                                    disabled={saving}
                                    style={{ maxWidth: 320 }}
                                >
                                    {(Object.keys(REGISTRATION_MODE_LABELS) as RegistrationMode[]).map((m) => (
                                        <option key={m} value={m}>{REGISTRATION_MODE_LABELS[m]}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">账户启用状态</div>
                            <div className="detail-value flex items-center gap-12">
                                <Switch
                                    checked={accountInfo.is_active}
                                    onChange={(_, d) => handleToggleActive(d.checked)}
                                    disabled={saving}
                                />
                                <span className={`badge ${accountInfo.is_active ? "badge-success" : "badge-danger"}`}>
                                    {accountInfo.is_active ? "活跃" : "停用"}
                                </span>
                            </div>
                        </div>

                        <div className="detail-row">
                            <div className="detail-label">创建时间</div>
                            <div className="detail-value" style={{ fontSize: 13 }}>
                                {new Date(accountInfo.created_at).toLocaleString("zh-CN")}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 配额与功能控制卡片 */}
            <div className="card mt-16">
                <div className="card-title">
                    <span>设备连接配额与功能控制</span>
                    <Button
                        appearance="primary"
                        size="small"
                        icon={<Save24Regular />}
                        onClick={handleSaveQuotas}
                        disabled={loading || savingQuotas}
                    >
                        {savingQuotas ? <Spinner size="tiny" /> : "保存配额配置"}
                    </Button>
                </div>
                {loading ? (
                    <Spinner size="small" />
                ) : (
                    <div>
                        {Object.entries(QUOTA_META).map(([key, meta]) => {
                            const existing = quotas.find((q) => q.quota_key === key);
                            const currentVal = existing?.current_value ?? 0;
                            const draftVal = quotaDraft[key] ?? meta.defaultMax;

                            return (
                                <div className="settings-item" key={key}>
                                    <div className="settings-item-info" style={{ paddingRight: 16 }}>
                                        <div className="settings-item-label">{meta.label}</div>
                                        <div className="settings-item-hint">
                                            {meta.hint}
                                            {meta.type === "number" && (
                                                <span style={{ marginLeft: 8, color: "var(--accent-color)", fontWeight: 600 }}>
                                                    (当前实时已用: {currentVal})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        {meta.type === "boolean" ? (
                                            <Switch
                                                checked={Number(draftVal) >= 1}
                                                onChange={(_, d) =>
                                                    setQuotaDraft((prev) => ({ ...prev, [key]: d.checked ? 1 : 0 }))
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
                                                style={{ width: 140 }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {accountInfo && (
                <div
                    className="card mt-16"
                    style={{
                        borderColor: "var(--danger-color)",
                        borderWidth: 1,
                        borderStyle: "solid",
                    }}
                >
                    <div className="card-title" style={{ color: "var(--danger-color)" }}>
                        危险操作
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
                        删除账户后，所有成员、资源配置和预注册客户端将被清理，此操作不可撤销。
                    </p>
                    <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
                        <label style={{ fontSize: 13, fontWeight: 500 }}>
                            请输入账户名称「{accountInfo.name}」以确认:
                        </label>
                        <Input
                            value={deleteConfirm}
                            onChange={(_, d) => setDeleteConfirm(d.value)}
                            placeholder="输入当前账户名称以确认"
                        />
                        <Button
                            appearance="primary"
                            icon={<Delete24Regular />}
                            onClick={handleDeleteAccount}
                            disabled={deleting || deleteConfirm !== accountInfo.name}
                            style={{
                                backgroundColor: deleteConfirm === accountInfo.name ? "var(--danger-color)" : undefined,
                            }}
                        >
                            {deleting ? <Spinner size="tiny" /> : "确认删除租户账户"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
