import "server-only";
import { UTFile } from "uploadthing/server";
import { uploadthingAppId } from "@/lib/env";
import { isUploadthingConfigured, utapi } from "@/lib/utapi";

/** True when `url` is a file hosted by *this* app on UploadThing with the given key. */
export function isOwnUploadUrl(url: string, key: string) {
  const appId = uploadthingAppId();
  if (!appId) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const path = decodeURIComponent(u.pathname);
    if (u.hostname === `${appId}.ufs.sh` && path === `/f/${key}`) return true;
    if (u.hostname === "utfs.io" && (path === `/f/${key}` || path === `/a/${appId}/${key}`)) return true;
  } catch {
    return false;
  }
  return false;
}

/** Uploads a small `data:image/...;base64,` thumbnail from the server. */
export async function uploadDataUrlImage(dataUrl: string, name: string) {
  if (!isUploadthingConfigured()) return null;
  const match = dataUrl.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 600_000) return null;
  const ext = match[1].split("/")[1];
  const result = await utapi().uploadFiles(new UTFile([buffer], `${name}.${ext}`, { type: match[1] }));
  if (result.error || !result.data) return null;
  return { key: result.data.key, url: result.data.ufsUrl };
}
