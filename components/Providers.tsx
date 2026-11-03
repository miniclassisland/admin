"use client";

import React, { useMemo } from "react";
import {
    FluentProvider,
    webLightTheme,
    SSRProvider,
    RendererProvider,
    createDOMRenderer,
} from "@fluentui/react-components";
import { AuthProvider } from "@/lib/auth-context";
import AdminShell from "@/components/AdminShell";

const FONT_STACK = "'Google Sans Flex', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_FONT_STACK = "'Google Sans Code', 'Noto Sans SC', monospace";

const customTheme = {
    ...webLightTheme,
    fontFamilyBase: FONT_STACK,
    fontFamilyMonospace: MONO_FONT_STACK,
};

export default function Providers({ children }: { children: React.ReactNode }) {
    const renderer = useMemo(() => createDOMRenderer(), []);

    return (
        <RendererProvider renderer={renderer}>
            <SSRProvider>
                <FluentProvider theme={customTheme}>
                    <AuthProvider>
                        <AdminShell>
                            {children}
                        </AdminShell>
                    </AuthProvider>
                </FluentProvider>
            </SSRProvider>
        </RendererProvider>
    );
}
