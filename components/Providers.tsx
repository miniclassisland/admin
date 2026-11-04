"use client";

import React, { useMemo } from "react";
import {
    FluentProvider,
    webLightTheme,
    webDarkTheme,
    SSRProvider,
    RendererProvider,
    createDOMRenderer,
} from "@fluentui/react-components";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AccountProvider } from "@/lib/account-context";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-context";
import AdminShell from "@/components/AdminShell";

const FONT_STACK = "'Google Sans Flex', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT_STACK = "'Google Sans Code', 'Noto Sans SC', monospace";

const customLightTheme = {
    ...webLightTheme,
    fontFamilyBase: FONT_STACK,
    fontFamilyMonospace: MONO_FONT_STACK,
};

const customDarkTheme = {
    ...webDarkTheme,
    fontFamilyBase: FONT_STACK,
    fontFamilyMonospace: MONO_FONT_STACK,
};

function AccountWrapper({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    return (
        <AccountProvider isAuthenticated={isAuthenticated}>
            <AdminShell>
                {children}
            </AdminShell>
        </AccountProvider>
    );
}

function FluentThemeWrapper({ children }: { children: React.ReactNode }) {
    const { resolvedTheme } = useThemeMode();
    return (
        <FluentProvider
            theme={resolvedTheme === "dark" ? customDarkTheme : customLightTheme}
            style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
            <AuthProvider>
                <AccountWrapper>
                    {children}
                </AccountWrapper>
            </AuthProvider>
        </FluentProvider>
    );
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const renderer = useMemo(() => createDOMRenderer(), []);

    return (
        <RendererProvider renderer={renderer}>
            <SSRProvider>
                <ThemeModeProvider>
                    <FluentThemeWrapper>{children}</FluentThemeWrapper>
                </ThemeModeProvider>
            </SSRProvider>
        </RendererProvider>
    );
}
