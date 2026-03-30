import { Client } from "@microsoft/microsoft-graph-client";
import type {
  IPublicClientApplication,
  AccountInfo,
} from "@azure/msal-browser";
import { graphScopes } from "./msal-config";

function getGraphClient(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
): Client {
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

export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  lastModifiedDateTime?: string;
}

export interface SharePointSite {
  id: string;
  displayName: string;
  webUrl: string;
}

export async function searchSites(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  query: string,
): Promise<SharePointSite[]> {
  const client = getGraphClient(msalInstance, account);
  const result = await client
    .api(`/sites?search=${encodeURIComponent(query)}`)
    .get();
  return result.value || [];
}

export async function getSiteDrives(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  siteId: string,
) {
  const client = getGraphClient(msalInstance, account);
  const result = await client.api(`/sites/${siteId}/drives`).get();
  return result.value || [];
}

export async function listDriveItems(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  driveId: string,
  folderId?: string,
): Promise<DriveItem[]> {
  const client = getGraphClient(msalInstance, account);
  const path = folderId
    ? `/drives/${driveId}/items/${folderId}/children`
    : `/drives/${driveId}/root/children`;
  const result = await client.api(path).get();
  return result.value || [];
}

export async function uploadFileToSharePoint(
  msalInstance: IPublicClientApplication,
  account: AccountInfo,
  driveId: string,
  folderPath: string,
  fileName: string,
  content: ArrayBuffer,
): Promise<DriveItem> {
  const client = getGraphClient(msalInstance, account);
  const encodedPath = encodeURIComponent(`${folderPath}/${fileName}`).replace(
    /%2F/g,
    "/",
  );
  const result = await client
    .api(`/drives/${driveId}/root:/${encodedPath}:/content`)
    .putStream(content);
  return result;
}
