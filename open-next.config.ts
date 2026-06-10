// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
	// R2 incremental cache speeds Worker HTML MISSes — enable when a dedicated cache bucket is bound.
	// See https://opennext.js.org/cloudflare/caching
	// incrementalCache: r2IncrementalCache,
	/** Keep off with force-static storefront; avoids extra Worker work on cold starts. */
	routePreloadingBehavior: "none",
});
