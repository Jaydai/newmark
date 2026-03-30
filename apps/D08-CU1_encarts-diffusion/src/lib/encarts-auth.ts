"use client";

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
} from "@azure/msal-browser";
import { loginScopes, msalConfig } from "@/lib/msal-config";

const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

let msalInstancePromise: Promise<PublicClientApplication> | null = null;

async function getMsalInstance() {
  if (authDisabled) {
    return null;
  }

  if (!msalInstancePromise) {
    msalInstancePromise = (async () => {
      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();

      try {
        const response = await instance.handleRedirectPromise();
        if (response?.account) {
          instance.setActiveAccount(response.account);
        }
      } catch (error) {
        console.error("[MSAL] Redirect error:", error);
      }

      const accounts = instance.getAllAccounts();
      if (accounts.length > 0 && !instance.getActiveAccount()) {
        instance.setActiveAccount(accounts[0]);
      }

      return instance;
    })();
  }

  return msalInstancePromise;
}

export async function getEncartsBearerToken() {
  const instance = await getMsalInstance();
  if (!instance) {
    return null;
  }

  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
  if (!account) {
    throw new Error("Aucun compte Microsoft actif.");
  }

  try {
    const result = await instance.acquireTokenSilent({
      scopes: loginScopes,
      account,
    });

    return result.idToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ scopes: loginScopes });
      throw new Error("Authentification Microsoft requise.");
    }

    throw error;
  }
}
