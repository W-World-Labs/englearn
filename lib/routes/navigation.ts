import type { NavigateOptions } from "@tanstack/react-router";
import type { ModuleType } from "@/lib/types";

/** After finishing a test session → results report. */
export function resultsRoute(sessionId: string): NavigateOptions {
  return {
    to: "/results",
    search: { sid: sessionId },
    replace: true,
  };
}

export function historyRoute(page = 1): NavigateOptions {
  return {
    to: "/history",
    search: { page },
  };
}

/** Open assessment picker (optional module preset for deep links). */
export function testRoute(opts?: { modules?: ModuleType[] }): NavigateOptions {
  if (!opts?.modules?.length) {
    return { to: "/test" };
  }
  return {
    to: "/test",
    search: { modules: opts.modules },
  };
}