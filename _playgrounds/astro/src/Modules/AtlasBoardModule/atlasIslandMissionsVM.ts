import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";

/**
 * ONE ViewModel, for every island on the page that is not Svelte's.
 *
 * Three islands built one each, at module level, each with the same comment
 * saying a module means a store per process. All three were right and the page
 * was still wrong: three stores on one page means typing in the React island
 * leaves the Vue island beside it showing an unfiltered list, and nothing
 * anywhere reports it — the islands look correct one at a time, which is how
 * they were tested.
 *
 * At module level, and this file is imported by islands only. Astro renders an
 * island once on the server to produce the initial HTML, and a module-level
 * store is shared by every request that render serves — which is why a SERVER
 * gets its state through `hydrateLankaVM` and never through this. In a browser
 * the process is one tab, and one tab is exactly the lifetime a page's islands
 * should share.
 *
 * ## Svelte's island is deliberately not here
 *
 * It builds its ViewModel in the instance script, once per mount, and the
 * reason is written there: that is the one shape which stays correct if the
 * component is rendered on a server. Bringing it in would trade a real
 * guarantee for a symmetry, so the cross-island scenes name React, Vue and
 * Solid, and Svelte's island keeps its own store and says so.
 */
export const atlasIslandMissionsVM = createAtlasMissionsVM(new AtlasMissionGateway());
