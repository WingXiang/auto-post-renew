import type { Metadata } from "next";
import {
  ClerkProvider,
  OrganizationSwitcher,
  UserButton,
} from "@clerk/nextjs";
import { zhTW } from "@clerk/localizations";
import Link from "next/link";
import { MobileNav } from "@/components/mobile-nav";
import { PipelineSidebar } from "@/components/pipeline-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "社群媒體內容發文產線",
  description: "從選題到取得客戶的一條龍自動化系統",
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/brand", label: "品牌設定" },
  { href: "/topics", label: "主題管理" },
  { href: "/posts", label: "貼文排程" },
  { href: "/analytics", label: "數據分析" },
  { href: "/customers", label: "潛在客戶" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={zhTW}>
      <html lang="zh-TW" className="h-full">
        <body className="h-full bg-gray-50 text-gray-900 antialiased">
          <div className="flex h-full">
            <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
              <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
                <span className="text-lg font-bold text-blue-600">
                  AutoPost
                </span>
              </div>
              <div className="border-b border-gray-200 px-4 py-3">
                <OrganizationSwitcher
                  hidePersonal
                  afterSelectOrganizationUrl="/"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      organizationSwitcherTrigger: "w-full justify-between",
                    },
                  }}
                />
              </div>
              <nav className="space-y-1 px-3 py-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="flex-1 overflow-hidden border-t border-gray-200 p-3">
                <PipelineSidebar mode="sidebar" />
              </div>
              <div className="border-t border-gray-200 p-4">
                <UserButton
                  showName
                  appearance={{
                    elements: { userButtonBox: "flex-row-reverse" },
                  }}
                />
              </div>
            </aside>
            <main className="flex flex-1 flex-col overflow-hidden">
              <MobileNav />
              <div className="flex-1 overflow-auto p-6">{children}</div>
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
