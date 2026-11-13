import type { NitroAppPlugin } from "nitro/types";

const assetCache: NitroAppPlugin = (nitro) => {
  nitro.hooks.hook("response", (response, event) => {
    if (response.status >= 400 && new URL(event.req.url).pathname.startsWith("/assets/")) {
      response.headers.set("Cache-Control", "no-store");
    }
  });
};

export default assetCache;
