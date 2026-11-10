"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { ADMIN_VERSION } from "@/lib/version";

export default function VersionLine() {
    const [coreVersion, setCoreVersion] = useState("读取中...");

    useEffect(() => {
        let cancelled = false;
        adminApi.getVersion()
            .then((data) => {
                if (!cancelled) setCoreVersion(data?.version || "未知");
            })
            .catch(() => {
                if (!cancelled) setCoreVersion("未知");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <span>
            网页版本 {ADMIN_VERSION} | 核心版本 {coreVersion}
        </span>
    );
}
