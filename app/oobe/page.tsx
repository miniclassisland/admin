"use client";

import React, { useState } from "react";
import { Spinner, Input, Button, Label } from "@fluentui/react-components";
import { CheckmarkCircle24Filled, Settings24Regular } from "@fluentui/react-icons";

export default function OobePage() {
    const [step, setStep] = useState(1);
    const [passcode, setPasscode] = useState("");
    const [oobeToken, setOobeToken] = useState("");

    // Form inputs
    const [dbUrl, setDbUrl] = useState("postgresql+psycopg://postgres:password@localhost:5432/miniclassisland");
    const [redisUrl, setRedisUrl] = useState("redis://:password@localhost:6379/0");
    const [domain, setDomain] = useState("localminiclassisland.miniopensource.com");
    const [username, setUsername] = useState("admin");
    const [email, setEmail] = useState("admin@miniclassisland.com");
    const [password, setPassword] = useState("admin123");

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
        if (!passcode) {
            showStatus("请输入终端配对码", "error");
            return;
        }
        setLoading(true);
        showStatus("正在向服务端验证配对通行码...", "success");

        try {
            const formData = new FormData();
            formData.append("passcode", passcode.toUpperCase().trim());

            const res = await fetch("/api/oobe/verify", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.token) {
                setOobeToken(data.token);
                showStatus("配对码校验成功，正在载入表单...", "success");
                setTimeout(() => {
                    setStep(2);
                    showStatus("", "");
                }, 600);
            } else {
                showStatus(data.detail || "验证失败：配对码错误或已失效", "error");
            }
        } catch (err: unknown) {
            const errObj = err as { message?: string } | null;
            const rawMsg = errObj?.message || String(err);
            const displayMsg = rawMsg.includes("Failed to fetch") ? "未知的服务器回答，请联系管理员" : rawMsg;
            showStatus("请求发起失败: " + displayMsg, "error");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfigure(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        showStatus("核心系统服务数据库表创建中，请稍候...", "success");

        try {
            const formData = new FormData();
            formData.append("token", oobeToken);
            formData.append("db_url", dbUrl.trim());
            formData.append("redis_url", redisUrl.trim());
            formData.append("domain", domain.trim());
            formData.append("username", username.trim());
            formData.append("email", email.trim());
            formData.append("password", password.trim());

            const res = await fetch("/api/oobe/configure", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                showStatus("核心结构部署成功，正在热重启服务器程序...", "success");
                setTimeout(() => {
                    setStep(3);
                    showStatus("", "");
                }, 800);
            } else {
                showStatus(data.detail || "核心系统部署失败。", "error");
            }
        } catch (err: unknown) {
            const errObj = err as { message?: string } | null;
            const rawMsg = errObj?.message || String(err);
            const displayMsg = rawMsg.includes("Failed to fetch") ? "未知的服务器回答，请联系管理员" : rawMsg;
            showStatus("核心调用受挫: " + displayMsg, "error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
            <div style={{ width: "100%", maxWidth: 480, padding: 20 }}>
                <div className="card" style={{ padding: 40, boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)" }}>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                        <h1 className="title" style={{ fontSize: 22, fontWeight: 600, margin: "0 0 6px 0" }}>MINI ClassIsland</h1>
                        <p className="subtitle" style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>OOBE 首次开机配置向导</p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleVerify} className="fade-in">
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <Label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>终端配对通行码</Label>
                                <Input
                                    value={passcode}
                                    onChange={(_, d) => setPasscode(d.value)}
                                    placeholder="输入从控制台日志获取的 8 位大写配对码"
                                    autoComplete="off"
                                    style={{ width: "100%" }}
                                    contentBefore={<Settings24Regular />}
                                />
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
                                    出于安全考虑限制，您必须输入服务器控制台日志中输出的 passcode。
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} appearance="primary" style={{ width: "100%", backgroundColor: "var(--admin-accent)" }}>
                                {loading ? <Spinner size="tiny" label="验证中..." /> : "验证并开始配置"}
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleConfigure} className="fade-in">
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>PostgreSQL 数据库连接串</Label>
                                <Input value={dbUrl} onChange={(_, d) => setDbUrl(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Redis 连接串</Label>
                                <Input value={redisUrl} onChange={(_, d) => setRedisUrl(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>多租户隔离根域名</Label>
                                <Input value={domain} onChange={(_, d) => setDomain(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>管理员用户名</Label>
                                <Input value={username} onChange={(_, d) => setUsername(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>系统密保邮箱</Label>
                                <Input type="email" value={email} onChange={(_, d) => setEmail(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <Label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>初始登录密码</Label>
                                <Input type="password" value={password} onChange={(_, d) => setPassword(d.value)} style={{ width: "100%" }} required />
                            </div>
                            <Button type="submit" disabled={loading} appearance="primary" style={{ width: "100%", backgroundColor: "var(--admin-accent)" }}>
                                {loading ? <Spinner size="tiny" label="执行部署中..." /> : "提交配置并完成初始化"}
                            </Button>
                        </form>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: "center", padding: "20px 0" }} className="fade-in">
                            <CheckmarkCircle24Filled style={{ color: "var(--success-color)", fontSize: 48, marginBottom: 12 }} />
                            <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>系统初始化成功！</h3>
                            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                                后台服务正在执行安全热重启。几秒后，所有的 OOBE 拦截将解除，您可以直接刷新本页或通过管理主站进行登录。
                            </p>
                        </div>
                    )}

                    {statusText && (
                        <div className={`status-box ${statusType}`} style={{
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
