import { defineEventHandler, getRequestHeaders } from "h3";
import { readAtlasMissions } from "../../src/Core/Server/readAtlasMissions";

/**
 * Nitro's half of the seam: a route handler with a request in its hands.
 *
 * `getRequestHeaders` gives a plain object, which is one of the two shapes
 * `runLankaRequest` takes — the other is a `Headers`, which is what Next and a
 * loader hand over. Neither is adapted here, because the host layer takes both:
 * that is what makes it a seam rather than an adapter for whoever came first.
 */
export default defineEventHandler((event) => readAtlasMissions(getRequestHeaders(event)));
