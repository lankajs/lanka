import { readAtlasMissions } from "../Core/Server/readAtlasMissions";
import type { PageServerLoad } from "./$types";

/**
 * Kit's half of the seam: a load function with a real `Request` in its hands.
 *
 * `request.headers` is a `Headers`, which is one of the two shapes
 * `runLankaRequest` takes — the other is a plain object, which is what Nitro
 * hands over. Neither is adapted here, because the host layer takes both: that
 * is what makes it a seam rather than an adapter for whoever came first.
 *
 * `+page.server.ts` and not `+page.ts`: a universal load runs on the server AND
 * in the browser, and this one reaches a gateway that needs the caller's cookie.
 * The `.server` suffix is Kit refusing to ship it, and that refusal is the
 * reason to use the suffix rather than a comment.
 */
export const load: PageServerLoad = async ({ request }) => ({
	missions: await readAtlasMissions(request.headers),
});
