/**
 * Atlas for Vue — the VIEW layer its applications share.
 *
 * Composables over the ViewModels `@lanka-playgrounds/_shared` owns, and the
 * text rules its screens agree on. There is no `ViewModels/` folder here and
 * there will not be one: a ViewModel holds state and actions and knows nothing
 * about a renderer, and an effect is a fact about Vue.
 *
 * One entry, unlike React's two. React's ecosystem spans a DOM and a device, so
 * its DOM half has to be reachable separately; every Vue host here renders to a
 * document.
 */
export { default as AtlasAvatar } from "./Modules/AtlasMissionsModule/AtlasAvatar.vue";
export { formatAtlasMissionLine } from "./Modules/AtlasMissionsModule/formatAtlasMissionLine";
export { useAtlasMissions } from "./Modules/AtlasMissionsModule/useAtlasMissions";
export { useAtlasMissionsOnMount } from "./Modules/AtlasMissionsModule/useAtlasMissionsOnMount";

export type { TAtlasMissionsVM } from "./Modules/AtlasMissionsModule/useAtlasMissions";
