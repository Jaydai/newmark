"use client";

import { ReactNode, useEffect, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig, loginScopes } from "@/lib/msal-config";

const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (authDisabled) {
    return <>{children}</>;
  }

  const [isInitialized, setIsInitialized] = useState(false);
  const [msalInstance, setMsalInstance] =
    useState<PublicClientApplication | null>(null);

  useEffect(() => {
    const instance = new PublicClientApplication(msalConfig);
    setMsalInstance(instance);

    instance.initialize().then(async () => {
      try {
        const response = await instance.handleRedirectPromise();
        if (response?.account) {
          instance.setActiveAccount(response.account);
        }
      } catch (e) {
        console.error("[MSAL] Redirect error:", e);
      }

      const accounts = instance.getAllAccounts();
      if (accounts.length > 0 && !instance.getActiveAccount()) {
        instance.setActiveAccount(accounts[0]);
      }

      // SSO: if no account yet, try to silently acquire a token
      // using the Azure AD session cookie (from another Jaydai app)
      if (instance.getAllAccounts().length === 0) {
        try {
          const ssoResult = await instance.ssoSilent({
            scopes: loginScopes,
          });
          if (ssoResult?.account) {
            instance.setActiveAccount(ssoResult.account);
          }
        } catch {
          // No existing session — user will see the login screen
        }
      }

      setIsInitialized(true);
    });
  }, []);

  if (!isInitialized || !msalInstance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
