"use client";

import { ReactNode, useEffect, useRef } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { loginScopes } from "@/lib/msal-config";
import Image from "next/image";
import { LogIn, Shield } from "lucide-react";

const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

export function AuthGuard({ children }: { children: ReactNode }) {
  if (authDisabled) {
    return <>{children}</>;
  }

  return <MsalAuthGuard>{children}</MsalAuthGuard>;
}

function MsalAuthGuard({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const tried = useRef(false);

  useEffect(() => {
    if (accounts.length === 0 && !tried.current) {
      tried.current = true;
      instance.ssoSilent({ scopes: loginScopes }).catch(() => {});
    }
  }, [instance, accounts]);

  const handleLogin = () => {
    instance.loginRedirect({ scopes: loginScopes });
  };

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <div className="min-h-screen flex flex-col bg-background">
          <header className="border-b border-border bg-white/80 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
              <Image
                src="/newmark-logo.svg"
                alt="Newmark"
                width={160}
                height={36}
                priority
                className="h-8 w-auto"
              />
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center px-6">
            <div className="max-w-md text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-light mb-6">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                Connexion requise
              </h1>
              <p className="text-text-secondary mb-8">
                Connectez-vous avec votre compte Microsoft professionnel pour
                acceder a la plateforme Jaydai.
              </p>
              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-3 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent/90 transition-colors shadow-sm"
              >
                <LogIn className="w-5 h-5" />
                Se connecter avec Microsoft
              </button>
            </div>
          </main>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
