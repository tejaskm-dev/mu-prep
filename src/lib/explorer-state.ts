import { RESOURCE_TYPES, SORT_OPTIONS, TAG_LABELS, type SortValue } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";

export type ExplorerState = {
  type: ResourceType | "all";
  module: number | "full" | null;
  tags: string[];
  year: number | null;
  verified: boolean;
  q: string;
  sort: SortValue;
  view: "grid" | "list";
};

export function parseExplorerState(sp: Record<string, string | string[] | undefined>): ExplorerState {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const type = get("type");
  const mod = get("module");
  const sort = get("sort");
  return {
    type: RESOURCE_TYPES.some((t) => t.value === type) ? (type as ResourceType) : "all",
    module: mod === "full" ? "full" : Number(mod) > 0 ? Number(mod) : null,
    tags: get("tags").split(",").filter((t) => t in TAG_LABELS),
    year: Number(get("year")) || null,
    verified: get("verified") === "1",
    q: get("q").slice(0, 80),
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortValue) : "newest",
    view: get("view") === "list" ? "list" : "grid",
  };
}


export const DEFAULT_EXPLORER_STATE: ExplorerState = {
  type: "all",
  module: null,
  tags: [],
  year: null,
  verified: false,
  q: "",
  sort: "newest",
  view: "grid",
};
