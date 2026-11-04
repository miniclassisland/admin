import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MINI ClassIsland 超级管理平台",
  description: "MINI ClassIsland 集中管理平台 - 超级管理员控制台",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("miniclassisland_theme_mode")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=d?"dark":"light";document.documentElement.setAttribute("data-theme",r);document.documentElement.setAttribute("data-theme-mode",m);document.documentElement.style.colorScheme=r;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
