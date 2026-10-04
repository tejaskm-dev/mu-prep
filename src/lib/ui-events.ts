"use client";

// Tiny event bus so any button can open the global search or class picker.
export const OPEN_SEARCH = "muprep:open-search";
export const OPEN_CLASS_PICKER = "muprep:open-class-picker";
export const NAV_START = "muprep:nav-start";

/** Start the top progress bar for programmatic navigations (router.push). */
export function startNavProgress() {
  window.dispatchEvent(new CustomEvent(NAV_START));
}

export function openSearch(query = "") {
  window.dispatchEvent(new CustomEvent(OPEN_SEARCH, { detail: { query } }));
}

export function openClassPicker() {
  window.dispatchEvent(new CustomEvent(OPEN_CLASS_PICKER));
}
