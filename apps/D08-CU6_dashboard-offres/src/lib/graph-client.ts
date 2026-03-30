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
  lastModifiedBy?: {
    user?: { displayName: string };
  };
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: {
    driveId: string;
    path: string;
  };
}

/** Create an authenticated Graph client using MSAL */
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
        // If silent fails, trigger redirect for re-authentication
        msalInstance.acquireTokenRedirect({ scopes: graphScopes.files });
        done(error as Error, null);
      }
    },
  });
}

/** Search for SharePoint sites the user has access to */
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

/** Get document libraries (drives) for a site */
export async function getSiteDrives(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  siteId: string
): Promise<SharePointDrive[]> {
  const client = getGraphClient(msalInstance, account);
  const response = await client.api(`/sites/${siteId}/drives`).get();
  return response.value ?? [];
}

/** List files in a drive's root or a specific folder */
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

/** List files in a folder by path (e.g. "D08CU6_Raw_Data") on a site's default drive */
export async function listFolderByPath(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  siteId: string,
  folderPath: string,
): Promise<{ files: SharePointFile[]; driveId: string }> {
  const client = getGraphClient(msalInstance, account);
  const drive = await client.api(`/sites/${siteId}/drive`).select("id").get();
  const driveId: string = drive.id;
  const response = await client
    .api(`/drives/${driveId}/root:/${folderPath}:/children`)
    .orderby("name")
    .top(200)
    .get();
  return { files: response.value ?? [], driveId };
}

/** Download a file's content as ArrayBuffer */
export async function downloadFile(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  driveId: string,
  fileId: string
): Promise<ArrayBuffer> {
  const client = getGraphClient(msalInstance, account);
  // Get item metadata with the pre-authenticated download URL
  // This avoids the 302 redirect CORS issue with /content endpoint
  const item = await client
    .api(`/drives/${driveId}/items/${fileId}`)
    .get();

  const downloadUrl: string | undefined =
    item["@microsoft.graph.downloadUrl"];
  if (!downloadUrl) {
    throw new Error("URL de téléchargement introuvable");
  }

  // Fetch directly from the pre-authenticated URL (no auth headers needed)
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Téléchargement échoué (${response.status})`);
  }
  return response.arrayBuffer();
}
