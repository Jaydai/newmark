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
  console.log("[Graph] downloadFile driveId=%s fileId=%s", driveId, fileId);
  const client = getGraphClient(msalInstance, account);

  // Get the pre-authenticated download URL from driveItem metadata.
  // Using /content directly causes CORS failures because the Graph API
  // returns a 302 redirect to sharepoint.com which blocks cross-origin.
  const item = await client
    .api(`/drives/${driveId}/items/${fileId}`)
    .select("id,@microsoft.graph.downloadUrl")
    .get();
  console.log("[Graph] driveItem response keys:", Object.keys(item));

  const downloadUrl: string | undefined = item["@microsoft.graph.downloadUrl"];
  if (downloadUrl) {
    console.log("[Graph] Using pre-authenticated downloadUrl");
    const resp = await fetch(downloadUrl);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    return resp.arrayBuffer();
  }

  // Fallback: try the /content endpoint directly
  console.log("[Graph] No downloadUrl, falling back to /content");
  const response = await client
    .api(`/drives/${driveId}/items/${fileId}/content`)
    .responseType("arraybuffer" as never)
    .get();
  return response as ArrayBuffer;
}

/**
 * Search all accessible SharePoint sites + drives for a file by name,
 * download it, and return the buffer + enough metadata for refresh.
 */
export async function findAndDownloadFile(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  targetFileName: string,
): Promise<{ buffer: ArrayBuffer; driveId: string; fileId: string; fileName: string } | null> {
  console.log("[AutoLoad] Step 1: searching sites…");
  const sites = await searchSites(msalInstance, account);
  console.log("[AutoLoad] Found %d sites:", sites.length, sites.map((s) => s.displayName));

  for (const site of sites) {
    console.log("[AutoLoad] Step 2: getting drives for site '%s'…", site.displayName);
    const drives = await getSiteDrives(msalInstance, account, site.id);
    console.log("[AutoLoad]   Found %d drives:", drives.length, drives.map((d) => d.name));

    for (const drive of drives) {
      console.log("[AutoLoad] Step 3: listing items in drive '%s'…", drive.name);
      const items = await listDriveItems(msalInstance, account, drive.id);
      console.log("[AutoLoad]   Found %d items:", items.length, items.map((f) => f.name));

      const match = items.find(
        (f) => f.name.toLowerCase() === targetFileName.toLowerCase(),
      );
      if (match) {
        console.log("[AutoLoad] Step 4: downloading '%s' (id=%s)…", match.name, match.id);
        const buffer = await downloadFile(msalInstance, account, drive.id, match.id);
        console.log("[AutoLoad] Download complete, %d bytes", buffer.byteLength);
        return { buffer, driveId: drive.id, fileId: match.id, fileName: match.name };
      }
    }
  }

  console.warn("[AutoLoad] File '%s' not found in any site/drive", targetFileName);
  return null;
}
