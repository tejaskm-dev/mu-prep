import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";

/** A salted hash of the caller's IP — enough for rate limiting without storing IPs. */
export function hashIp(raw: string | null | undefined) {
  const ip = (raw ?? "").split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${serverEnv().ipSalt}:${ip}`).digest("hex").slice(0, 32);
}

export async function currentIpHash() {
  const h = await headers();
  return hashIp(h.get("x-forwarded-for") ?? h.get("x-real-ip"));
}
