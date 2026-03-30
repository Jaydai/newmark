import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";

const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID?.trim();
const allowedTenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID?.trim() || null;
const JWKS = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
);

export class AuthenticationError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
  }
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export type AuthenticatedUser = {
  oid: string | null;
  tid: string | null;
  name: string | null;
  preferredUsername: string | null;
};

export async function requireAuthenticatedRequest(
  request: Request,
): Promise<AuthenticatedUser | null> {
  if (authDisabled) {
    return null;
  }

  if (!clientId) {
    throw new AuthenticationError(
      "Configuration Azure manquante pour proteger l'API.",
      500,
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new AuthenticationError("Authentification Microsoft requise.");
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: clientId,
    });

    const tenantId =
      typeof payload.tid === "string" ? payload.tid.trim() : null;
    if (allowedTenantId && tenantId !== allowedTenantId) {
      throw new AuthenticationError("Tenant Microsoft non autorise.", 403);
    }

    const issuer = typeof payload.iss === "string" ? payload.iss : "";
    if (
      !issuer.startsWith("https://login.microsoftonline.com/") &&
      !issuer.startsWith("https://sts.windows.net/")
    ) {
      throw new AuthenticationError("Jeton Microsoft invalide.");
    }

    return {
      oid: typeof payload.oid === "string" ? payload.oid : null,
      tid: tenantId,
      name: typeof payload.name === "string" ? payload.name : null,
      preferredUsername:
        typeof payload.preferred_username === "string"
          ? payload.preferred_username
          : null,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError("Jeton Microsoft invalide.");
  }
}
