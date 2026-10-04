import type { ResourceType } from "@/lib/database.types";

export type ItemStatus = "queued" | "compressing" | "uploading" | "uploaded" | "error" | "published";

export type ItemMeta = {
  title: string;
  subjectId: string | null;
  type: ResourceType;
  module: number | null;
  tags: string[];
  examSession: string;
  examYear: number | null;
  author: string;
  description: string;
  isVerified: boolean;
};

export type UploadItem = {
  id: string;
  kind: "file" | "link";
  file?: File;
  name: string;
  size: number;
  mime: string;
  status: ItemStatus;
  progress: number;
  error?: string;
  upload?: { key: string; url: string };
  externalUrl?: string;
  analyzing: boolean;
  pageCount: number | null;
  hash?: string;
  duplicate?: { id?: string; title: string; subject?: string; inBatch?: boolean } | null;
  thumb: { status: "none" | "pending" | "uploading" | "done" | "error"; preview?: string; key?: string; url?: string };
  meta: ItemMeta;
  touched: (keyof ItemMeta)[];
  detection: { reason?: string; confidence?: "high" | "medium"; signals: string[] };
  selected: boolean;
  expanded: boolean;
  resourceId?: string;
  compression?: {
    changed: boolean;
    originalSize: number;
    compressedSize: number;
    detail: string;
  };
};

export type BatchDefaults = {
  department: string | null;
  semester: number | null;
  subjectId: string | null;
  type: ResourceType | "auto";
  tags: string[];
  author: string;
  isVerified: boolean;
  publish: boolean;
  compress: boolean;
};

export const EMPTY_DEFAULTS: BatchDefaults = {
  department: null,
  semester: null,
  subjectId: null,
  type: "auto",
  tags: [],
  author: "",
  isVerified: false,
  publish: true,
  compress: true,
};
