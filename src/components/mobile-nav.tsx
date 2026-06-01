"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/brand", label: "品牌設定" },
  { href: "/topics", label: "主題管理" },
  { href: "/posts", label: "貼文排程" },
  { href: "/analytics", label: "數據分析" },
  { href: "/customers", label: "潛在客戶" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
          aria-label="開啟選單"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="text-lg font-bold text-blue-600">AutoPost</span>
        <UserButton />
      </header>

      {open && (
        <div className="border-b border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
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
          <nav className="space-y-1 px-3 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
