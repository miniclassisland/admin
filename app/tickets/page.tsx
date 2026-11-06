"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import {
    Badge,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Input,
    MessageBar,
    MessageBarBody,
    Spinner,
    Switch,
    Textarea,
} from "@fluentui/react-components";
import { Select } from "@/components/CustomSelect";
import {
    ArrowLeft24Regular,
    ArrowRight24Regular,
    ArrowSync24Regular,
    Search24Regular,
    Send24Regular,
} from "@fluentui/react-icons";
import styles from "./tickets.module.css";

const PAGE_SIZE = 20;

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
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
    const [priorityFilter, setPriorityFilter] = useState<"" | TicketPriority>("");
    const [categoryFilter, setCategoryFilter] = useState<"" | TicketCategory>("");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [query, setQuery] = useState("");
    const [offset, setOffset] = useState(0);

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
                    offset,
                    limit: PAGE_SIZE,
                    status: statusFilter || undefined,
                    priority: priorityFilter || undefined,
                    category: categoryFilter || undefined,
                    q: query || undefined,
                    unreadOnly,
                });
                setItems(Array.isArray(data.items) ? data.items : []);
                setTotal(Number(data.total) || 0);
            } catch (e) {
                setError(e instanceof Error ? e.message : "加载工单列表失败");
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [offset, statusFilter, priorityFilter, categoryFilter, query, unreadOnly],
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
        setSearchInput("");
        setQuery("");
        setOffset(0);
    }

    const page = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
                    icon={<ArrowSync24Regular />}
                    onClick={() => loadTickets()}
                    disabled={loading}
                >
                    刷新
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

            <div className={styles.toolbar}>
                <Input
                    placeholder="搜索标题、内容、用户名或邮箱..."
                    value={searchInput}
                    onChange={(_, d) => setSearchInput(d.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            setQuery(searchInput.trim());
                            setOffset(0);
                        }
                    }}
                    contentBefore={<Search24Regular />}
                    style={{ width: 280 }}
                />
                <Button
                    size="small"
                    onClick={() => {
                        setQuery(searchInput.trim());
                        setOffset(0);
                    }}
                >
                    搜索
                </Button>
                <Select
                    value={statusFilter}
                    onChange={(_, d) => {
                        setStatusFilter(d.value as "" | TicketStatus);
                        setOffset(0);
                    }}
                    style={{ width: 130 }}
                >
                    <option value="">全部状态</option>
                    {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
                <Select
                    value={priorityFilter}
                    onChange={(_, d) => {
                        setPriorityFilter(d.value as "" | TicketPriority);
                        setOffset(0);
                    }}
                    style={{ width: 120 }}
                >
                    <option value="">全部优先级</option>
                    {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
                <Select
                    value={categoryFilter}
                    onChange={(_, d) => {
                        setCategoryFilter(d.value as "" | TicketCategory);
                        setOffset(0);
                    }}
                    style={{ width: 140 }}
                >
                    <option value="">全部分类</option>
                    {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Select>
                <Switch
                    checked={unreadOnly}
                    onChange={(_, d) => {
                        setUnreadOnly(d.checked);
                        setOffset(0);
                    }}
                    label="仅未读"
                />
                <Button size="small" appearance="subtle" onClick={resetFilters}>
                    清除筛选
                </Button>
                <span className={styles.muted}>共 {total} 个工单</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center" style={{ height: 200 }}>
                    <Spinner size="medium" />
                </div>
            ) : items.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center" }}>
                    <div className={styles.muted}>暂无符合条件的工单</div>
                </div>
            ) : (
                <>
                    <div className="card" style={{ overflowX: "auto" }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>状态</th>
                                    <th>标题</th>
                                    <th>提交用户</th>
                                    <th>分类</th>
                                    <th>优先级</th>
                                    <th>更新时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
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
                                        <td>
                                            <Button size="small" appearance="secondary">
                                                处理
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className={styles.pager}>
                            <Button
                                size="small"
                                icon={<ArrowLeft24Regular />}
                                disabled={offset === 0}
                                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                            >
                                上一页
                            </Button>
                            <span className={styles.muted}>
                                第 {page} / {totalPages} 页
                            </span>
                            <Button
                                size="small"
                                icon={<ArrowRight24Regular />}
                                iconPosition="after"
                                disabled={offset + PAGE_SIZE >= total}
                                onClick={() => setOffset(offset + PAGE_SIZE)}
                            >
                                下一页
                            </Button>
                        </div>
                    )}
                </>
            )}

            <Dialog
                open={detailOpen}
                onOpenChange={(_, data) => {
                    if (!data.open && !saving && !replying) {
                        setDetailOpen(false);
                        setDetail(null);
                    }
                }}
            >
                <DialogSurface style={{ maxWidth: 820, width: "100%" }}>
                    <DialogBody>
                        <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                {detail?.subject || "工单详情"}
                            </span>
                            {detail && (
                                <Badge
                                    appearance="filled"
                                    color={STATUS_COLORS[detail.status]}
                                >
                                    {TICKET_STATUS_LABELS[detail.status]}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogContent>
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

                                    <div className={styles.meta} style={{ marginBottom: 10 }}>
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
                                        <div className={styles.composerActions}>
                                            <span className={styles.muted}>
                                                回复会通知用户并更新工单状态
                                            </span>
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
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="secondary"
                                onClick={() => {
                                    setDetailOpen(false);
                                    setDetail(null);
                                }}
                                disabled={saving || replying}
                            >
                                关闭
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
