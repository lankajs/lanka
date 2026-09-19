import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * `process.env` and no bundler global, because nothing bundles this one: the
 * service runs in node and reads its environment the way node does. The browser
 * applications here need a build-time inline for the same value; this is the
 * package that shows the seam does not require one.
 *
 * It lives in `.lanka_di/` while the alias resolves to `.lanka/` — the second
 * kind of split this application carries, and `.lanka/Host.ts` is the one line
 * that reaches it. A host is one value and cannot be sharded; it can move.
 */
export const lankaHost: ILankaHost = createAtlasHost(
	process.env.NEXT_PUBLIC_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
