/**
 * Atlas for React — the part with no DOM in it.
 *
 * Everything here renders nowhere and runs everywhere React does: hooks over the
 * ViewModels `@lanka-playgrounds/_shared` owns, and the text rules a list and a
 * `FlatList` agree on. The device application imports this barrel and only this
 * one; `./dom` is the half it cannot compile.
 */
export { formatAtlasMissionLine } from "./Core/Missions/formatAtlasMissionLine";
export { useAtlasHydratedMissions } from "./ViewModels/AtlasMissionsViewModel/useAtlasHydratedMissions";
export { useAtlasMissions } from "./ViewModels/AtlasMissionsViewModel/useAtlasMissions";
export { useAtlasMissionsOnMount } from "./ViewModels/AtlasMissionsViewModel/useAtlasMissionsOnMount";

export type { TAtlasMissionsVM } from "./ViewModels/AtlasMissionsViewModel/useAtlasMissions";
export type { TAtlasWritableMissionsVM } from "./ViewModels/AtlasMissionsViewModel/useAtlasHydratedMissions";
