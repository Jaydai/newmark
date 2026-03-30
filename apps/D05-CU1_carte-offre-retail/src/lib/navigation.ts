const configuredHubUrl = process.env.NEXT_PUBLIC_HUB_URL?.trim() || "";

export function resolveHubUrl() {
  if (configuredHubUrl) {
    return configuredHubUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3016";
    }
  }

  return "https://salmon-beach-0b063fe03.2.azurestaticapps.net";
}

export function resolveMapsBackHref(returnToHub: boolean) {
  return returnToHub ? resolveHubUrl() : "/";
}
