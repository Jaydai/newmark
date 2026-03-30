import { Configuration, LogLevel } from "@azure/msal-browser";

const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!;
const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID!;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId || "common"}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
    postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error("[MSAL]", message);
      },
      logLevel: LogLevel.Error,
    },
  },
};

/** Scopes required for SharePoint file access via Microsoft Graph */
export const graphScopes = {
  user: ["User.Read"],
  files: ["Files.Read.All", "Sites.Read.All"],
};

/** All scopes needed at login time */
export const loginScopes = [...graphScopes.user, ...graphScopes.files];

/** The tenant ID — used for validation if needed */
export const allowedTenantId = tenantId;
