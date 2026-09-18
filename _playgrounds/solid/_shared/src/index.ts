/**
 * Atlas for Solid — the VIEW layer its applications share.
 *
 * An accessor over the ViewModels `@lanka-playgrounds/_shared` owns, and the
 * text rule its screens agree on. There is no `ViewModels/` folder here and
 * there will not be one: a ViewModel holds state and actions and knows nothing
 * about a renderer, and an effect is a fact about Solid.
 *
 * One entry, like Vue's and Svelte's and unlike React's two. React's ecosystem
 * spans a DOM and a device, so its DOM half has to be reachable separately;
 * every Solid host here renders to a document.
 */
export { formatAtlasMissionLine } from "./Modules/AtlasMissionsModule/formatAtlasMissionLine";
export { useAtlasMissions } from "./Modules/AtlasMissionsModule/useAtlasMissions";

export type { TAtlasMissionsVM } from "./Modules/AtlasMissionsModule/useAtlasMissions";
