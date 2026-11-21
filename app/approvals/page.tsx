"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/api";
import type {
    ApprovalRequestItem,
    ApprovalRequestStatus,
    ApprovalRequestType,
} from "@/lib/types";
import {
    APPROVAL_REQUEST_STATUS_LABELS,
    APPROVAL_REQUEST_TYPE_LABELS,
    QUOTA_META,
} from "@/lib/types";
import { matchAdvancedQuery } from "@/lib/search-engine";
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
    Spinner,
    Switch,
    Textarea,
} from "@fluentui/react-components";
import { MessageBar, MessageBarBody } from "@/components/ToastMessageBar";
import { Select } from "@/components/CustomSelect";
import {
    ArrowClockwise24Regular,
    Checkmark24Regular,
    ChevronLeft16Regular,
    ChevronRight16Regular,
    Dismiss24Regular,
    Search24Regular,
    ShieldTask24Regular,
} from "@fluentui/react-icons";

type BadgeColor =
    | "brand"
    | "danger"
    | "important"
    | "informative"
    | "success"
    | "warning"
    | "severe"
    | "subtle";

const STATUS_COLORS: Record<ApprovalRequestStatus, BadgeColor> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    cancelled: "subtle",
};

function formatQuotaVal(key: string, val: number): string {
    const meta = QUOTA_META[key];
    if (meta?.type === "boolean") {
        return val >= 1 ? "已启用" : "已禁用";
    }
    return val < 0 ? "不限制" : String(val);
}

function formatTime(value: string | null | undefined): string {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminApprovalsPage() {
    const [items, setItems] = useState<ApprovalRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<"" | ApprovalRequestStatus>("pending");
    const [typeFilter, setTypeFilter] = useState<"" | ApprovalRequestType>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // 审批对话框状态
    const [reviewTarget, setReviewTarget] = useState<ApprovalRequestItem | null>(null);
    const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
    const [approvedValueStr, setApprovedValueStr] = useState("");
    const [approvedUnlimited, setApprovedUnlimited] = useState(false);
    const [reviewNote, setReviewNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadRequests = useCallback(
        async (silent = false) => {
            if (!silent) setLoading(true);
            setError(null);
            try {
                const res = await adminApi.listApprovalRequests({
                    offset: 0,
                    limit: 200,
                    status: statusFilter || undefined,
                    requestType: typeFilter || undefined,
                });
                setItems(Array.isArray(res.items) ? res.items : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : "加载审批申请列表失败");
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [statusFilter, typeFilter],
    );

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const scheduleRefresh = () => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                void loadRequests(true);
            }, 250);
        };
        const unsubscribe = adminApi.subscribeEvents({
            onEvent: (evt) => {
                if (
                    evt.event === "approval_request.created" ||
                    evt.event === "approval_request.updated"
                ) {
                    scheduleRefresh();
                }
            },
        });
        return () => {
            unsubscribe();
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
    }, [loadRequests]);

    const filteredItems = useMemo(() => {
        return items.filter((item) =>
            matchAdvancedQuery(item, searchQuery, {
                fields: {
                    account: (r) => [r.account_name, r.account_slug, r.account_id],
                    user: (r) => [
                        r.user?.username || "",
                        r.user?.display_name || "",
                        r.user?.email || "",
                    ],
                    key: (r) => [r.target_key, QUOTA_META[r.target_key]?.label || ""],
                },
                freeText: (r) => [
                    r.account_name,
                    r.account_slug,
                    r.target_key,
                    QUOTA_META[r.target_key]?.label || "",
                    r.reason,
                    r.review_note,
                    r.user?.username || "",
                    r.user?.display_name || "",
                    r.user?.email || "",
                ],
            }),
        );
    }, [items, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pagedItems = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredItems.slice(start, start + pageSize);
    }, [filteredItems, safePage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, typeFilter, pageSize]);

    function openReviewDialog(item: ApprovalRequestItem, action: "approve" | "reject") {
        setReviewTarget(item);
        setReviewAction(action);
        setReviewNote("");
        if (item.request_type === "quota") {
            if (item.requested_value === -1) {
                setApprovedUnlimited(true);
                setApprovedValueStr("");
            } else {
                setApprovedUnlimited(false);
                setApprovedValueStr(String(item.requested_value));
            }
        } else {
            setApprovedUnlimited(false);
            setApprovedValueStr("1");
        }
    }

    async function handleConfirmReview() {
        if (!reviewTarget) return;
        setSubmitting(true);
        setError(null);
        setNotice(null);
        try {
            if (reviewAction === "approve") {
                const approvedValue =
                    reviewTarget.request_type === "permission"
                        ? 1
                        : approvedUnlimited
                            ? -1
                            : parseInt(approvedValueStr, 10);
                if (
                    reviewTarget.request_type === "quota" &&
                    !approvedUnlimited &&
                    (!Number.isFinite(approvedValue) || approvedValue < 1)
                ) {
                    setError("请输入有效的批准配额数值");
                    setSubmitting(false);
                    return;
                }
                await adminApi.approveApprovalRequest(reviewTarget.id, {
                    approved_value: approvedValue,
                    review_note: reviewNote.trim(),
                });
                setNotice(
                    `已批准「${reviewTarget.account_name || reviewTarget.account_id}」的${
                        APPROVAL_REQUEST_TYPE_LABELS[reviewTarget.request_type]
                    }申请，配额/权限已立即生效。`,
                );
            } else {
                await adminApi.rejectApprovalRequest(reviewTarget.id, {
                    review_note: reviewNote.trim(),
                });
                setNotice(
                    `已拒绝「${reviewTarget.account_name || reviewTarget.account_id}」的${
                        APPROVAL_REQUEST_TYPE_LABELS[reviewTarget.request_type]
                    }申请。`,
                );
            }
            setReviewTarget(null);
            await loadRequests(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "处理审批申请失败");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">配额与权限审批</h1>
                    <p className="page-subtitle">
                        专用审批处理通道：审核租户提交的增开配额与功能权限申请，批准后立即生效
                    </p>
                </div>
                <Button
                    appearance="secondary"
                    icon={<ArrowClockwise24Regular />}
                    onClick={() => void loadRequests()}
                    disabled={loading}
                >
                    刷新
                </Button>
            </div>

            {error && (
                <MessageBar intent="error" style={{ marginBottom: 14 }}>
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {notice && (
                <MessageBar intent="success" style={{ marginBottom: 14 }}>
                    <MessageBarBody>{notice}</MessageBarBody>
                </MessageBar>
            )}

            <div className="card" style={{ marginBottom: 16 }}>
                <div
                    className="flex items-center justify-between gap-12"
                    style={{ flexWrap: "wrap" }}
                >
                    <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                        <Select
                            size="small"
                            value={statusFilter}
                            onChange={(_, d) => setStatusFilter(d.value as "" | ApprovalRequestStatus)}
                            style={{ minWidth: 130 }}
                        >
                            <option value="pending">待审批</option>
                            <option value="">全部状态</option>
                            <option value="approved">已通过</option>
                            <option value="rejected">已拒绝</option>
                            <option value="cancelled">已撤回</option>
                        </Select>

                        <Select
                            size="small"
                            value={typeFilter}
                            onChange={(_, d) => setTypeFilter(d.value as "" | ApprovalRequestType)}
                            style={{ minWidth: 130 }}
                        >
                            <option value="">全部类型</option>
                            <option value="quota">增开配额</option>
                            <option value="permission">申请权限</option>
                        </Select>
                    </div>

                    <div className="flex items-center gap-8" style={{ flex: 1, maxWidth: 360 }}>
                        <Input
                            size="small"
                            contentBefore={<Search24Regular />}
                            placeholder="搜索租户、申请人、项目或理由..."
                            value={searchQuery}
                            onChange={(_, d) => setSearchQuery(d.value)}
                            style={{ width: "100%" }}
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="empty-state">
                        <Spinner size="medium" label="加载审批申请中..." />
                    </div>
                ) : pagedItems.length === 0 ? (
                    <div className="empty-state">
                        <ShieldTask24Regular style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 8 }} />
                        <div className="empty-state-text">暂无符合条件的审批申请</div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {pagedItems.map((item) => {
                            const meta = QUOTA_META[item.target_key];
                            const targetLabel = meta?.label || item.target_key;
                            const applicantLabel = item.user
                                ? `${item.user.display_name || item.user.username} (${item.user.email})`
                                : item.user_id;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: "14px 16px",
                                        borderRadius: "var(--radius-md)",
                                        border: "1px solid var(--border-color)",
                                        background: "var(--bg-secondary)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        gap: 16,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 260 }}>
                                        <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
                                            <Badge
                                                appearance="tint"
                                                color={item.request_type === "quota" ? "brand" : "informative"}
                                            >
                                                {APPROVAL_REQUEST_TYPE_LABELS[item.request_type] || item.request_type}
                                            </Badge>
                                            <strong style={{ fontSize: 14 }}>{targetLabel}</strong>
                                            <Badge
                                                appearance="filled"
                                                color={STATUS_COLORS[item.status] || "subtle"}
                                            >
                                                {APPROVAL_REQUEST_STATUS_LABELS[item.status] || item.status}
                                            </Badge>
                                        </div>

                                        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                                            租户：<strong>{item.account_name || item.account_id}</strong>
                                            {item.account_slug ? ` (${item.account_slug})` : ""} · 申请人：{applicantLabel}
                                        </div>

                                        <div style={{ fontSize: 13 }}>
                                            {item.request_type === "quota" ? (
                                                <>
                                                    配额变更：当前 <strong>{formatQuotaVal(item.target_key, item.current_value)}</strong> → 申请{" "}
                                                    <strong style={{ color: "var(--accent-color)" }}>
                                                        {formatQuotaVal(item.target_key, item.requested_value)}
                                                    </strong>
                                                    {item.status === "approved" &&
                                                        item.approved_value !== null &&
                                                        item.approved_value !== undefined && (
                                                            <>
                                                                {" "}· 实际批准：
                                                                <strong style={{ color: "var(--success-color)" }}>
                                                                    {formatQuotaVal(item.target_key, item.approved_value)}
                                                                </strong>
                                                            </>
                                                        )}
                                                </>
                                            ) : (
                                                <>
                                                    权限变更：申请开通 <strong>{targetLabel}</strong>
                                                    <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
                                                        ({item.target_key})
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                padding: "8px 10px",
                                                borderRadius: 6,
                                                background: "var(--bg-card)",
                                                border: "1px solid var(--border-color)",
                                                whiteSpace: "pre-wrap",
                                            }}
                                        >
                                            {item.reason}
                                        </div>

                                        {item.review_note && (
                                            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                                                审批备注：{item.review_note}
                                            </div>
                                        )}

                                        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                                            提交时间：{formatTime(item.created_at)}
                                            {item.reviewed_at ? ` · 审批时间：${formatTime(item.reviewed_at)}` : ""}
                                        </div>
                                    </div>

                                    {item.status === "pending" && (
                                        <div className="flex items-center gap-8" style={{ flexShrink: 0 }}>
                                            <Button
                                                appearance="primary"
                                                size="small"
                                                icon={<Checkmark24Regular />}
                                                onClick={() => openReviewDialog(item, "approve")}
                                            >
                                                批准
                                            </Button>
                                            <Button
                                                appearance="secondary"
                                                size="small"
                                                icon={<Dismiss24Regular />}
                                                onClick={() => openReviewDialog(item, "reject")}
                                            >
                                                拒绝
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {filteredItems.length > 0 && (
                    <div
                        className="flex items-center justify-between gap-12"
                        style={{
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: "1px solid var(--border-color)",
                            flexWrap: "wrap",
                        }}
                    >
                        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                            共 {filteredItems.length} 条记录 · 第 {safePage} / {totalPages} 页
                        </span>
                        <div className="flex items-center gap-8">
                            <Select
                                size="small"
                                value={String(pageSize)}
                                onChange={(_, d) => setPageSize(parseInt(d.value, 10))}
                                style={{ width: 96 }}
                            >
                                <option value="10">10 / 页</option>
                                <option value="20">20 / 页</option>
                                <option value="50">50 / 页</option>
                            </Select>
                            <Button
                                size="small"
                                appearance="subtle"
                                icon={<ChevronLeft16Regular />}
                                disabled={safePage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            />
                            <Button
                                size="small"
                                appearance="subtle"
                                icon={<ChevronRight16Regular />}
                                disabled={safePage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            />
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                open={Boolean(reviewTarget)}
                onOpenChange={(_, data) => {
                    if (!submitting && !data.open) setReviewTarget(null);
                }}
            >
                <DialogSurface style={{ maxWidth: 480 }}>
                    <DialogBody>
                        <DialogTitle>
                            {reviewAction === "approve" ? "批准审批申请" : "拒绝审批申请"}
                        </DialogTitle>
                        <DialogContent style={{ paddingTop: 8 }}>
                            {reviewTarget && (
                                <>
                                    <div
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: "var(--radius-md)",
                                            background: "var(--bg-secondary)",
                                            border: "1px solid var(--border-color)",
                                            fontSize: 12.5,
                                            marginBottom: 14,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 4,
                                        }}
                                    >
                                        <div>
                                            租户：<strong>{reviewTarget.account_name || reviewTarget.account_id}</strong>
                                        </div>
                                        <div>
                                            申请项：<strong>{QUOTA_META[reviewTarget.target_key]?.label || reviewTarget.target_key}</strong>
                                        </div>
                                        {reviewTarget.request_type === "quota" && (
                                            <div>
                                                当前 {formatQuotaVal(reviewTarget.target_key, reviewTarget.current_value)} → 申请{" "}
                                                <strong>{formatQuotaVal(reviewTarget.target_key, reviewTarget.requested_value)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {reviewAction === "approve" && reviewTarget.request_type === "quota" && (
                                        <div className="form-group">
                                            <div className="flex items-center justify-between gap-8" style={{ marginBottom: 6 }}>
                                                <label className="form-label" style={{ margin: 0 }}>实际批准配额上限</label>
                                                <div className="flex items-center gap-6">
                                                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>不限制</span>
                                                    <Switch
                                                        checked={approvedUnlimited}
                                                        onChange={(_, d) => setApprovedUnlimited(d.checked)}
                                                    />
                                                </div>
                                            </div>
                                            {!approvedUnlimited && (
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={1000000}
                                                    value={approvedValueStr}
                                                    onChange={(_, d) => setApprovedValueStr(d.value)}
                                                    style={{ width: "100%" }}
                                                />
                                            )}
                                        </div>
                                    )}

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">
                                            {reviewAction === "approve" ? "审批备注（可选）" : "拒绝原因（建议填写）"}
                                        </label>
                                        <Textarea
                                            value={reviewNote}
                                            maxLength={1000}
                                            rows={3}
                                            onChange={(_, d) => setReviewNote(d.value)}
                                            placeholder={
                                                reviewAction === "approve"
                                                    ? "可填写审批说明，将展示给租户"
                                                    : "请说明拒绝原因，便于租户补充信息后重新申请"
                                            }
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </>
                            )}
                        </DialogContent>
                        <DialogActions style={{ marginTop: 14 }}>
                            <Button
                                appearance="secondary"
                                onClick={() => setReviewTarget(null)}
                                disabled={submitting}
                            >
                                取消
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={() => void handleConfirmReview()}
                                disabled={
                                    submitting ||
                                    (reviewAction === "approve" &&
                                        reviewTarget?.request_type === "quota" &&
                                        !approvedUnlimited &&
                                        !approvedValueStr.trim())
                                }
                                style={
                                    reviewAction === "reject"
                                        ? { background: "var(--danger-color)" }
                                        : undefined
                                }
                            >
                                {submitting ? (
                                    <Spinner size="tiny" />
                                ) : reviewAction === "approve" ? (
                                    "确认批准并生效"
                                ) : (
                                    "确认拒绝"
                                )}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
