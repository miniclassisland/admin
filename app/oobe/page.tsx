"use client";

import React, { useState } from "react";
import { Spinner, Input, Button, Label } from "@fluentui/react-components";
import { CheckmarkCircle24Filled, Settings24Regular } from "@fluentui/react-icons";
import { getAdminUrl, getMainSiteUrl } from "@/lib/api";

export default function OobePage() {
    const [step, setStep] = useState(1);
    const [passcode, setPasscode] = useState("");
    const [oobeToken, setOobeToken] = useState("");

    // Form inputs
    const [dbUrl, setDbUrl] = useState("postgresql+psycopg://postgres:password@localhost:5432/miniclassisland");
    const [redisUrl, setRedisUrl] = useState("redis://localhost:6379/0");
    const [domain, setDomain] = useState("miniclassisland.com");
    const [username, setUsername] = useState("admin");
    const [email, setEmail] = useState("admin@miniclassisland.com");
    const [password, setPassword] = useState("");

    // Status
    const [statusText, setStatusText] = useState("");
    const [statusType, setStatusType] = useState<"success" | "error" | "">("");
    const [loading, setLoading] = useState(false);

    function showStatus(text: string, type: "success" | "error" | "") {
        setStatusText(text);
        setStatusType(type);
    }

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        if (!passcode.trim()) {
            showStatus("请输入终端配对码", "error");
            return;
        }
        setLoading(true);
        showStatus("正在向服务端验证配对通行码...", "success");

        try {
            const formData = new FormData();
            formData.append("passcode", passcode.toUpperCase().trim());

            const base = getAdminUrl();
            const res = await fetch(`${base}/oobe/verify`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.token) {
                setOobeToken(data.token);
                showStatus("配对码校验成功，正在载入配置向导...", "success");
                setTimeout(() => {
                    setStep(2);
                    showStatus("", "");
                }, 400);
            } else {
                showStatus(data.detail || "验证失败：配对码错误或已失效", "error");
            }
        } catch (err: unknown) {
            const errObj = err as { message?: string } | null;
            const rawMsg = errObj?.message || String(err);
            const displayMsg = rawMsg.includes("Failed to fetch") ? "无法连接至 MINI ClassIsland 服务端" : rawMsg;
            showStatus("请求失败: " + displayMsg, "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfigure(e: React.FormEvent) {
        e.preventDefault();
        if (password.trim().length < 8) {
            showStatus("管理员初始密码至少需要 8 位字符", "error");
            return;
        }
        setLoading(true);
        showStatus("正在初始化 MINI ClassIsland 核心数据库结构...", "success");

        try {
            const formData = new FormData();
            formData.append("token", oobeToken);
            formData.append("db_url", dbUrl.trim());
            formData.append("redis_url", redisUrl.trim());
            formData.append("domain", domain.trim());
            formData.append("username", username.trim());
            formData.append("email", email.trim());
            formData.append("password", password.trim());

            const base = getAdminUrl();
            const res = await fetch(`${base}/oobe/configure`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok) {
                showStatus("核心结构部署成功，正在热重启服务器程序...", "success");
                setTimeout(() => {
                    setStep(3);
                    showStatus("", "");
                }, 800);
            } else {
                showStatus(data.detail || "核心系统初始化失败。", "error");
            }
        } catch (err: unknown) {
            const errObj = err as { message?: string } | null;
            const rawMsg = errObj?.message || String(err);
            const displayMsg = rawMsg.includes("Failed to fetch") ? "无法连接至 MINI ClassIsland 服务端" : rawMsg;
            showStatus("初始化调用失败: " + displayMsg, "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
            <div style={{ width: "100%", maxWidth: 480, padding: 20 }}>
                <div className="card" style={{ padding: 36, boxShadow: "var(--shadow-md)" }}>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/icon.svg"
                            alt="MINI ClassIsland"
                            style={{ width: 56, height: 56, marginBottom: 12, display: "inline-block" }}
                        />
                        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px 0" }}>MINI ClassIsland</h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>OOBE 首次部署初始化向导</p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleVerify} className="fade-in">
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <Label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>终端配对通行码</Label>
                                <Input
                                    value={passcode}
                                    onChange={(_, d) => setPasscode(d.value)}
                                    placeholder="输入服务端控制台日志中的 8 位大写配对码"
                                    autoComplete="off"
                                    style={{ width: "100%" }}
                                    contentBefore={<Settings24Regular />}
                                />
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
                                    出于安全保护，首次配置需验证服务端启动日志中打印的 OOBE Passcode。
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} appearance="primary" style={{ width: "100%" }}>
                                {loading ? <Spinner size="tiny" label="验证中..." /> : "验证并开始配置"}
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleConfigure} className="fade-in">
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>PostgreSQL 数据库连接串</Label>
                                <Input value={dbUrl} onChange={(_, d) => setDbUrl(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Redis 连接串</Label>
                                <Input value={redisUrl} onChange={(_, d) => setRedisUrl(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>多租户服务根域名</Label>
                                <Input value={domain} onChange={(_, d) => setDomain(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="grid-2">
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>超级管理员用户名</Label>
                                    <Input value={username} onChange={(_, d) => setUsername(d.value)} style={{ width: "100%" }} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>超级管理员邮箱</Label>
                                    <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} style={{ width: "100%" }} required />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>初始登录密码</Label>
                                <Input
                                    type="password"
                                    placeholder="请设置超级管理员登录密码"
                                    value={password}
                                    onChange={(_, d) => setPassword(d.value)}
                                    style={{ width: "100%" }}
                                    required
                                />
                            </div>
                            <Button type="submit" disabled={loading} appearance="primary" style={{ width: "100%" }}>
                                {loading ? <Spinner size="tiny" label="执行初始化中..." /> : "提交配置并完成初始化"}
                            </Button>
                        </form>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: "center", padding: "16px 0" }} className="fade-in">
                            <CheckmarkCircle24Filled style={{ color: "var(--success-color)", fontSize: 48, marginBottom: 12 }} />
                            <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>MINI ClassIsland 初始化成功</h3>
                            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5, marginTop: 8, marginBottom: 16 }}>
                                后台服务正在执行安全热重启。几秒后所有的 OOBE 拦截将自动解除，您可前往集控主面板登录。
                            </p>
                            <Button
                                appearance="primary"
                                onClick={() => { window.location.href = getMainSiteUrl(); }}
                            >
                                前往集控主面板登录
                            </Button>
                        </div>
                    )}

                    {statusText && (
                        <div style={{
                            marginTop: 16,
                            padding: "10px 14px",
                            borderRadius: 4,
                            fontSize: 13,
                            background: statusType === "error" ? "#fde7e9" : "#dff6dd",
                            borderLeft: `3px solid ${statusType === "error" ? "var(--danger-color)" : "var(--success-color)"}`,
                            color: statusType === "error" ? "#a80000" : "#107c10",
                        }}>
                            {statusText}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
