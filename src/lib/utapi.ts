import "server-only";
import { UTApi } from "uploadthing/server";
import { serverEnv } from "@/lib/env";

let api: UTApi | null = null;

export function isUploadthingConfigured() {
  return Boolean(serverEnv().uploadthingToken);
}

export function utapi() {
  if (!isUploadthingConfigured()) throw new Error("UPLOADTHING_TOKEN is not set");
  api ??= new UTApi({ token: serverEnv().uploadthingToken });
  return api;
}

/** Best-effort removal of files from UploadThing (ignores missing keys). */
export async function deleteUploadedFiles(keys: (string | null | undefined)[]) {
  const clean = [...new Set(keys.filter((k): k is string => Boolean(k)))];
  if (clean.length === 0 || !isUploadthingConfigured()) return;
  try {
    await utapi().deleteFiles(clean);
  } catch (error) {
    console.error("[uploadthing] delete failed", error);
  }
}
