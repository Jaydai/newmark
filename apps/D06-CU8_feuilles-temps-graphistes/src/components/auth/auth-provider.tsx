"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/lib/msal-config";

const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (authDisabled) {
    return <>{children}</>;
  }

  return <MsalAuthProvider>{children}</MsalAuthProvider>;
}

function MsalAuthProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const msalInstance = useMemo(
    () =>
      typeof window === "undefined"
        ? null
        : new PublicClientApplication(msalConfig),
    [],
  );

  useEffect(() => {
    if (!msalInstance) {
      return;
    }

    msalInstance.initialize().then(async () => {
      try {
        const response = await msalInstance.handleRedirectPromise();
        if (response?.account) {
          msalInstance.setActiveAccount(response.account);
        }
      } catch (e) {
        console.error("[MSAL] Redirect error:", e);
      }

      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
        msalInstance.setActiveAccount(accounts[0]);
      }

      setIsInitialized(true);
    });
  }, [msalInstance]);

  if (!isInitialized || !msalInstance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
