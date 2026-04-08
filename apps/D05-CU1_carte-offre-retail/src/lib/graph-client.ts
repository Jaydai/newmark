import { Client } from "@microsoft/microsoft-graph-client";
import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { graphScopes } from "./msal-config";

export interface SharePointSite {
  id: string;
  displayName: string;
  webUrl: string;
}

export interface SharePointDrive {
  id: string;
  name: string;
  webUrl: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  webUrl: string;
  lastModifiedBy?: { user?: { displayName: string } };
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { driveId: string; path: string };
}

function getGraphClient(msalInstance: IPublicClientApplication, account: AccountInfo): Client {
  return Client.init({
    authProvider: async (done) => {
      try {
        const response = await msalInstance.acquireTokenSilent({
          scopes: graphScopes.files,
          account,
        });
        done(null, response.accessToken);
      } catch (error) {
        msalInstance.acquireTokenRedirect({ scopes: graphScopes.files });
        done(error as Error, null);
      }
    },
  });
}

export async function searchSites(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  query?: string
): Promise<SharePointSite[]> {
  const client = getGraphClient(msalInstance, account);
  const endpoint = query ? `/sites?search=${encodeURIComponent(query)}` : "/sites?search=*";
  const response = await client.api(endpoint).get();
  return response.value ?? [];
}

export async function getSiteDrives(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  siteId: string
): Promise<SharePointDrive[]> {
  const client = getGraphClient(msalInstance, account);
  const response = await client.api(`/sites/${siteId}/drives`).get();
  return response.value ?? [];
}

export async function listDriveItems(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  driveId: string,
  folderId?: string
): Promise<SharePointFile[]> {
  const client = getGraphClient(msalInstance, account);
  const path = folderId
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/drives/${driveId}/root/children`;
  const response = await client.api(path).orderby("name").top(200).get();
  return response.value ?? [];
}

export async function downloadFile(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  driveId: string,
  fileId: string
): Promise<ArrayBuffer> {
  const client = getGraphClient(msalInstance, account);
  const response = await client
    .api(`/drives/${driveId}/items/${fileId}/content`)
    .responseType("arraybuffer" as never)
    .get();
  return response as ArrayBuffer;
}

/**
 * Encode a SharePoint sharing URL for the /shares Graph API endpoint.
 * @see https://learn.microsoft.com/en-us/graph/api/shares-get
 */
function encodeSharingUrl(url: string): string {
  const base64 = btoa(url)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `u!${base64}`;
}

export interface SharingDriveItem {
  id: string;
  name: string;
  driveId: string;
}

/**
 * Download a file directly from a SharePoint sharing URL,
 * returning both the file buffer and enough metadata for refresh.
 */
export async function downloadFileFromSharingUrl(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  sharingUrl: string,
): Promise<{ buffer: ArrayBuffer; driveItem: SharingDriveItem }> {
  const client = getGraphClient(msalInstance, account);
  const encoded = encodeSharingUrl(sharingUrl);

  const meta = await client.api(`/shares/${encoded}/driveItem`).get();

  const buffer = await client
    .api(`/shares/${encoded}/driveItem/content`)
    .responseType("arraybuffer" as never)
    .get();

  return {
    buffer: buffer as ArrayBuffer,
    driveItem: {
      id: meta.id,
      name: meta.name,
      driveId: meta.parentReference?.driveId ?? "",
    },
  };
}
