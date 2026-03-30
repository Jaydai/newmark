"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { LogOut } from "lucide-react";
import clsx from "clsx";

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/agents", label: "Agents" },
  { href: "/prompts", label: "Prompts" },
];

export default function Navbar() {
  const { instance } = useMsal();
  const account = instance.getActiveAccount();
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-4 no-underline">
              <Image
                src="/newmark-logo.svg"
                alt="Newmark"
                width={140}
                height={32}
                priority
                className="h-7 w-auto"
              />
              <div className="h-6 w-px bg-border" />
              <span className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">
                Jaydai
              </span>
            </Link>

            <nav className="flex items-center gap-1 ml-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-xs font-medium no-underline transition-colors",
                    pathname === link.href
                      ? "bg-accent-light text-accent"
                      : "text-text-secondary hover:text-foreground hover:bg-surface-hover"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {account && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary">
                {account.name || account.username}
              </span>
              <button
                onClick={() => instance.logoutRedirect()}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-foreground hover:bg-surface-hover transition-colors"
                title="Se deconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
