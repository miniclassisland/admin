"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import {
    TICKET_CATEGORY_LABELS,
    TICKET_PRIORITY_LABELS,
    TICKET_STATUS_LABELS,
} from "@/lib/types";
import type {
    TicketCategory,
    TicketDetail,
    TicketItem,
    TicketPriority,
    TicketStatus,
} from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
import {
    Badge,
    Button,
    Input,
    Popover,
    PopoverSurface,
    PopoverTrigger,
    Spinner,
    Switch,
    Textarea,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import {
    ArrowLeft24Regular,
    ArrowSync24Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
    Filter16Regular,
    Search24Regular,
    Send24Regular,
} from "@fluentui/react-icons";
import styles from "./tickets.module.css";

type BadgeColor =
    | "brand"
    | "danger"
    | "important"
    | "informative"
    | "success"
    | "warning"
    | "severe"
    | "subtle";

const STATUS_COLORS: Record<TicketStatus, BadgeColor> = {
    open: "warning",
    in_progress: "informative",
    resolved: "success",
    closed: "subtle",
};

const PRIORITY_COLORS: Record<TicketPriority, BadgeColor> = {
    low: "subtle",
    normal: "brand",
    high: "important",
    urgent: "danger",
};

function formatTime(value: string | null | undefined): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminTicketsPage() {
    const [items, setItems] = useState<TicketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
    const [priorityFilter, setPriorityFilter] = useState<"" | TicketPriority>("");
    const [categoryFilter, setCategoryFilter] = useState<"" | TicketCategory>("");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detail, setDetail] = useState<TicketDetail | null>(null);
    const [draftStatus, setDraftStatus] = useState<TicketStatus>("open");
    const [draftPriority, setDraftPriority] = useState<TicketPriority>("normal");
    const [saving, setSaving] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);

    const loadTickets = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            setError(null);
            try {
                const data = await adminApi.listTickets({
                    offset: 0,
                    limit: 200,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    category: categoryFilter || undefined,
                    unreadOnly,
                });
                setItems(Array.isArray(data.items) ? data.items : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : "加载工单列表失败");
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [statusFilter, priorityFilter, categoryFilter, unreadOnly],
    );

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    async function openDetail(ticketId: string) {
        setDetailOpen(true);
        setDetailLoading(true);
        setDetail(null);
        setReplyText("");
        setError(null);
        try {
            const data = await adminApi.getTicket(ticketId);
            setDetail(data);
            setDraftStatus(data.status);
            setDraftPriority(data.priority);
            setItems((prev) =>
                prev.map((item) =>
                    item.id === data.id ? { ...item, admin_unread: false } : item,
                ),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "加载工单详情失败");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    function closeDetailView() {
        if (saving || replying) return;
        setDetailOpen(false);
        setDetail(null);
        setReplyText("");
    }

    async function handleReply() {
        if (!detail || !replyText.trim()) return;
        setReplying(true);
        setError(null);
        setNotice(null);
        try {
            await adminApi.replyTicket(detail.id, replyText.trim());
            setReplyText("");
            const fresh = await adminApi.getTicket(detail.id);
            setDetail(fresh);
            setDraftStatus(fresh.status);
            setDraftPriority(fresh.priority);
            await loadTickets(true);
            setNotice("回复已发送，工单已进入处理中。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "发送回复失败");
        } finally {
            setReplying(false);
        }
    }

    async function handleSaveStatus() {
        if (!detail) return;
        if (draftStatus === detail.status && draftPriority === detail.priority) return;
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const updated = await adminApi.updateTicket(detail.id, {
                status: draftStatus,
                priority: draftPriority,
            });
            setDetail(updated);
            setDraftStatus(updated.status);
            setDraftPriority(updated.priority);
            await loadTickets(true);
            setNotice("工单状态已更新。");
        } catch (e) {
            setError(e instanceof Error ? e.message : "更新工单失败");
        } finally {
            setSaving(false);
        }
    }

    function resetFilters() {
        setStatusFilter("");
        setPriorityFilter("");
        setCategoryFilter("");
        setUnreadOnly(false);
        setSearchQuery("");
        setCurrentPage(1);
    }

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (statusFilter && item.status !== statusFilter) return false;
            if (priorityFilter && item.priority !== priorityFilter) return false;
            if (categoryFilter && item.category !== categoryFilter) return false;
            if (unreadOnly && !item.admin_unread) return false;
            return matchAdvancedQuery(item, searchQuery, {
                fields: {
                    status: (t) => [t.status, TICKET_STATUS_LABELS[t.status] || ""],
                    priority: (t) => [t.priority, TICKET_PRIORITY_LABELS[t.priority] || ""],
                    category: (t) => [t.category, TICKET_CATEGORY_LABELS[t.category] || ""],
                    unread: (t) => Boolean(t.admin_unread),
                    user: (t) => [t.user?.username || "", t.user?.display_name || "", t.user?.email || "", t.user_id],
                    id: (t) => t.id,
                },
                freeText: (t) => [
                    t.id,
                    t.subject,
                    t.user?.username,
                    t.user?.display_name,
                    t.user?.email,
                    t.user_id,
                    TICKET_STATUS_LABELS[t.status],
                    TICKET_PRIORITY_LABELS[t.priority],
                    TICKET_CATEGORY_LABELS[t.category],
                ],
            });
        });
    }, [items, statusFilter, priorityFilter, categoryFilter, unreadOnly, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

    if (detailOpen) {
        return (
            <div className="fade-in">
                <div className="page-header" style={{ marginBottom: 16 }}>
                    <div className="flex items-center gap-12" style={{ flexWrap: "wrap", minWidth: 0 }}>
                        <Button
                            appearance="secondary"
                            icon={<ArrowLeft24Regular />}
                            onClick={closeDetailView}
                            disabled={saving || replying}
                        >
                            返回工单列表
                        </Button>
                        <h1 className="page-title" style={{ fontSize: 20, margin: 0 }}>
                            {detail?.subject || "工单详情"}
                        </h1>
                        {detail && (
                            <Badge
                                appearance="filled"
                                color={STATUS_COLORS[detail.status]}
                            >
                                {TICKET_STATUS_LABELS[detail.status]}
                            </Badge>
                        )}
                    </div>
                </div>

                {error && (
                    <MessageBar intent="error" style={{ marginBottom: 12 }}>
                        <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                )}
                {notice && (
                    <MessageBar intent="success" style={{ marginBottom: 12 }}>
                        <MessageBarBody>{notice}</MessageBarBody>
                    </MessageBar>
                )}

                <div className="card" style={{ width: "100%", marginBottom: 0 }}>
                    {detailLoading || !detail ? (
                        <div
                            className="flex items-center justify-center"
                            style={{ height: 220 }}
                        >
                            <Spinner size="medium" />
                        </div>
                    ) : (
                        <>
                            <div className={styles.userCard}>
                                <strong>
                                    {detail.user?.display_name ||
                                        detail.user?.username ||
                                        "未知用户"}
                                </strong>
                                <span>@{detail.user?.username || detail.user_id}</span>
                                <span>{detail.user?.email || "-"}</span>
                                <Badge appearance="tint" color="subtle">
                                    {detail.user?.role_code || "unknown"}
                                </Badge>
                                {detail.user && !detail.user.is_active && (
                                    <Badge appearance="filled" color="danger">
                                        已停用
                                    </Badge>
                                )}
                            </div>

                            <div className={styles.meta} style={{ marginBottom: 12 }}>
                                <span>#{detail.id}</span>
                                <span>{TICKET_CATEGORY_LABELS[detail.category]}</span>
                                <span>提交于 {formatTime(detail.created_at)}</span>
                            </div>

                            <div className={styles.controls}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">状态</label>
                                    <Select
                                        value={draftStatus}
                                        onChange={(_, d) =>
                                            setDraftStatus(d.value as TicketStatus)
                                        }
                                        style={{ width: "100%" }}
                                    >
                                        {Object.entries(TICKET_STATUS_LABELS).map(
                                            ([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </Select>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">优先级</label>
                                    <Select
                                        value={draftPriority}
                                        onChange={(_, d) =>
                                            setDraftPriority(d.value as TicketPriority)
                                        }
                                        style={{ width: "100%" }}
                                    >
                                        {Object.entries(TICKET_PRIORITY_LABELS).map(
                                            ([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </Select>
                                </div>
                                <Button
                                    appearance="secondary"
                                    onClick={handleSaveStatus}
                                    disabled={
                                        saving ||
                                        (draftStatus === detail.status &&
                                            draftPriority === detail.priority)
                                    }
                                >
                                    {saving ? <Spinner size="tiny" /> : "保存状态"}
                                </Button>
                            </div>

                            <div className={styles.thread}>
                                <div className={styles.message}>
                                    <div className={styles.messageHead}>
                                        <span>
                                            {detail.user?.display_name ||
                                                detail.user?.username ||
                                                "用户"}
                                        </span>
                                        <span>{formatTime(detail.created_at)}</span>
                                    </div>
                                    <div className={styles.messageBody}>
                                        {detail.content}
                                    </div>
                                </div>
                                {detail.messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`${styles.message} ${
                                            message.author_role === "admin"
                                                ? styles.messageAdmin
                                                : ""
                                        }`}
                                    >
                                        <div className={styles.messageHead}>
                                            <span>
                                                {message.author_role === "admin"
                                                    ? "超级管理员"
                                                    : detail.user?.display_name ||
                                                      detail.user?.username ||
                                                      "用户"}
                                            </span>
                                            <span>{formatTime(message.created_at)}</span>
                                        </div>
                                        <div className={styles.messageBody}>
                                            {message.content}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={styles.composer}>
                                {detail.status === "closed" && (
                                    <div className={styles.muted}>
                                        该工单已关闭；发送回复会自动重新打开并进入处理中。
                                    </div>
                                )}
                                <Textarea
                                    value={replyText}
                                    maxLength={5000}
                                    onChange={(_, d) => setReplyText(d.value)}
                                    rows={4}
                                    placeholder="输入给用户的回复"
                                    style={{ width: "100%" }}
                                />
                            </div>

                            <div className={styles.composerActions}>
                                <span className={styles.muted}>
                                    回复会通知用户并更新工单状态
                                </span>
                                <div className={styles.dialogFooterRight}>
                                    <Button
                                        appearance="primary"
                                        icon={<Send24Regular />}
                                        onClick={handleReply}
                                        disabled={replying || !replyText.trim()}
                                    >
                                        {replying ? <Spinner size="tiny" /> : "发送回复"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">工单处理</h1>
                    <p className="page-subtitle">
                        查看用户提交的工单，回复并跟踪处理状态
                    </p>
                </div>
                <Button
                    appearance="secondary"
                    icon={<ArrowSync24Regular />}
                    onClick={() => loadTickets()}
                    disabled={loading}
                >
                    刷新列表
                </Button>
            </div>

            {error && (
                <MessageBar intent="error" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {notice && (
                <MessageBar intent="success" style={{ marginBottom: 12 }}>
                    <MessageBarBody>{notice}</MessageBarBody>
                </MessageBar>
            )}

            <div className="clients-main-pane">
                <div className="card" style={{ padding: "12px 16px", marginBottom: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Input
                            placeholder="搜索标题、用户、邮箱或高级过滤表达式"
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
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>状态筛选</div>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(_, d) => {
                                            setStatusFilter(d.value as "" | TicketStatus);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">全部状态</option>
                                        {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>优先级筛选</div>
                                    <Select
                                        size="small"
                                        value={priorityFilter}
                                        onChange={(_, d) => {
                                            setPriorityFilter(d.value as "" | TicketPriority);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">全部优先级</option>
                                        {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </Select>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>分类筛选</div>
                                    <Select
                                        size="small"
                                        value={categoryFilter}
                                        onChange={(_, d) => {
                                            setCategoryFilter(d.value as "" | TicketCategory);
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value="">全部分类</option>
                                        {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </Select>

                                    <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>仅显示未读</span>
                                        <Switch
                                            checked={unreadOnly}
                                            onChange={(_, d) => {
                                                setUnreadOnly(d.checked);
                                                setCurrentPage(1);
                                            }}
                                        />
                                    </div>

                                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>快捷表达式</div>
                                    <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                                        {[
                                            "status:open",
                                            "status:in_progress",
                                            "priority:urgent",
                                            "unread:true",
                                        ].map((expr) => (
                                            <Button
                                                key={expr}
                                                size="small"
                                                appearance="secondary"
                                                onClick={() => {
                                                    setSearchQuery((prev) => `${prev} ${expr}`.trim());
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                {expr}
                                            </Button>
                                        ))}
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            onClick={resetFilters}
                                        >
                                            重置
                                        </Button>
                                    </div>
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
                        <span>{items.length}个工单</span>
                        <span>{filteredItems.length}已筛选</span>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <div className="empty-state">
                            <Spinner size="medium" />
                        </div>
                    ) : pagedItems.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-text">暂无符合筛选条件的工单</div>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>状态</th>
                                    <th>标题</th>
                                    <th>提交用户</th>
                                    <th>分类</th>
                                    <th>优先级</th>
                                    <th>更新时间</th>
                                    <th style={{ width: 44 }} aria-label="进入" />
                                </tr>
                            </thead>
                            <tbody>
                                {pagedItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => openDetail(item.id)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <td>
                                            <Badge
                                                appearance="filled"
                                                color={STATUS_COLORS[item.status]}
                                            >
                                                {TICKET_STATUS_LABELS[item.status]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div
                                                className={
                                                    item.admin_unread
                                                        ? styles.unreadSubject
                                                        : styles.subject
                                                }
                                            >
                                                {item.subject}
                                            </div>
                                            <div className={styles.meta}>
                                                #{item.id.slice(0, 8)}
                                                <span>{item.message_count} 条回复</span>
                                                {item.admin_unread && (
                                                    <Badge appearance="filled" color="brand">
                                                        未读
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                {item.user?.display_name ||
                                                    item.user?.username ||
                                                    item.user_id.slice(0, 8)}
                                            </div>
                                            <div className={styles.meta}>
                                                {item.user?.email || "-"}
                                            </div>
                                        </td>
                                        <td>{TICKET_CATEGORY_LABELS[item.category]}</td>
                                        <td>
                                            <Badge
                                                appearance="tint"
                                                color={PRIORITY_COLORS[item.priority]}
                                            >
                                                {TICKET_PRIORITY_LABELS[item.priority]}
                                            </Badge>
                                        </td>
                                        <td>{formatTime(item.updated_at)}</td>
                                        <td style={{ textAlign: "right", color: "var(--text-tertiary)" }}>
                                            <ChevronRight16Regular style={{ verticalAlign: "middle" }} />
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
        </div>
    );
}
