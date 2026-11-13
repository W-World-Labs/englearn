import type { MessageParams, MessageTree } from "./types";

export function deepMergeMessages(
  base: MessageTree,
  override?: MessageTree
): MessageTree {
  if (!override) return base;
  const out: MessageTree = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (Array.isArray(o) || typeof o === "string") {
      out[key] = o;
    } else if (
      o &&
      typeof o === "object" &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[key] = deepMergeMessages(b as MessageTree, o as MessageTree);
    } else {
      out[key] = o;
    }
  }
  return out;
}

export function getByPath(
  tree: MessageTree,
  path: string
): string | string[] | undefined {
  const parts = path.split(".");
  let cur: string | string[] | MessageTree | undefined = tree;
  for (const p of parts) {
    if (cur === undefined || typeof cur === "string" || Array.isArray(cur)) {
      return undefined;
    }
    cur = cur[p];
  }
  if (typeof cur === "string" || Array.isArray(cur)) return cur;
  return undefined;
}

export function interpolate(
  template: string,
  params?: MessageParams
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined ? "" : String(v);
  });
}

export function createTranslator(messages: MessageTree) {
  return function t(path: string, params?: MessageParams): string {
    const raw = getByPath(messages, path);
    if (typeof raw !== "string") return path;
    return interpolate(raw, params);
  };
}