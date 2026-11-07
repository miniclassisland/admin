"use client";

/**
 * MINI ClassIsland 超级管理平台 — 系统参数设置页面。
 * 调用 Admin API: GET /settings, POST /settings
 */

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { SETTINGS_LABELS, SETTINGS_ALLOWED_KEYS } from "@/lib/types";
import {
    Button,
    Spinner,
    Input,
    Switch,
    Textarea,
    MessageBar,
    MessageBarBody,
} from "@fluentui/react-components";
import { Select } from "@/components/CustomSelect";
import { ArrowSync24Regular, Save24Regular } from "@fluentui/react-icons";

export default function SettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [dirty, setDirty] = useState(false);
    const [refreshingCommunity, setRefreshingCommunity] = useState(false);

    async function loadSettings() {
        setLoading(true);
        setError(null);
        try {
            const data = await adminApi.getSettings();
            const mapped: Record<string, string> = {};
            for (const [k, v] of Object.entries(data)) {
                mapped[k] = String(v ?? "");
            }
            setSettings(mapped);
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载系统设置失败");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadSettings();
    }, []);

    function updateSetting(key: string, value: string) {
        setSettings(prev => ({ ...prev, [key]: value }));
        setDirty(true);
        setSuccessMsg(null);
    }

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const filteredSettings: Record<string, string> = {};
            for (const key of SETTINGS_ALLOWED_KEYS) {
                if (key in settings) {
                    filteredSettings[key] = settings[key];
                }
            }
            await adminApi.updateSettings({ items: filteredSettings });
            setSuccessMsg("系统参数设置已保存");
            setDirty(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "保存失败");
        } finally {
            setSaving(false);
        }
    }

    async function handleRefreshCommunityCode() {
        setRefreshingCommunity(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await adminApi.refreshCommunityCode();
            setSuccessMsg("入群密钥已轮换");
        } catch (e) {
            setError(e instanceof Error ? e.message : "轮换入群密钥失败");
        } finally {
            setRefreshingCommunity(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ height: 200 }}>
                <Spinner size="medium" />
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">系统参数设置</h1>
                    <p className="page-subtitle">配置 MINI ClassIsland 平台全局注册策略、默认权限与通知公告</p>
                </div>
                <Button
                    appearance="primary"
                    icon={<Save24Regular />}
                    disabled={!dirty || saving}
                    onClick={handleSave}
                >
                    {saving ? <Spinner size="tiny" /> : "保存设置"}
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

            <div className="card">
                <div className="settings-section">
                    <div className="settings-section-title">注册、租户与全局公告配置</div>

                    {Object.entries(SETTINGS_LABELS).map(([key, meta]) => (
                        <div className="settings-item" key={key}>
                            <div className="settings-item-info">
                                <div className="settings-item-label">{meta.label}</div>
                                <div className="settings-item-hint">{meta.hint}</div>
                            </div>
                            <div>
                                {meta.type === "boolean" ? (
                                    <Switch
                                        checked={settings[key] === "true" || settings[key] === "1"}
                                        onChange={(_, d) => updateSetting(key, d.checked ? "true" : "false")}
                                    />
                                ) : meta.type === "number" ? (
                                    <Input
                                        type="number"
                                        value={settings[key] || ""}
                                        onChange={(_, d) => updateSetting(key, d.value)}
                                        style={{ width: 120 }}
                                    />
                                ) : key === "default_role" ? (
                                    <Select
                                        value={settings[key] || "normal"}
                                        onChange={(_, d) => updateSetting(key, d.value)}
                                    >
                                        <option value="normal">普通用户 (normal)</option>
                                        <option value="pending">待审核 (pending)</option>
                                    </Select>
                                ) : meta.type === "textarea" ? (
                                    <Textarea
                                        value={settings[key] || ""}
                                        onChange={(_, d) => updateSetting(key, d.value)}
                                        style={{ width: 320 }}
                                        rows={3}
                                        placeholder={meta.placeholder || "输入内容"}
                                    />
                                ) : (
                                    <Input
                                        value={settings[key] || ""}
                                        onChange={(_, d) => updateSetting(key, d.value)}
                                        style={{ width: 320 }}
                                        placeholder={meta.placeholder || "输入内容"}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
                <div className="settings-section">
                    <div className="settings-section-title">交流社区</div>
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <div className="settings-item-label">清空待使用入群码</div>
                            <div className="settings-item-hint">
                                入群码现按个人用户独立生成（有效期 15 分钟，入群后由机器人自动审核绑定）。点击此按钮可立即作废所有尚未使用的待审入群码。
                            </div>
                        </div>
                        <Button
                            icon={<ArrowSync24Regular />}
                            onClick={handleRefreshCommunityCode}
                            disabled={refreshingCommunity}
                        >
                            {refreshingCommunity ? <Spinner size="tiny" /> : "作废所有待审入群码"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
