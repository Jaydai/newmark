"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import Navbar from "@/components/navbar";
import Footer from "@/components/sections/footer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthGuard>
  );
}
