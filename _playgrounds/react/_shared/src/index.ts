/**
 * Atlas for React — the part with no DOM in it.
 *
 * Everything here renders nowhere and runs everywhere React does: hooks over the
 * ViewModels `@lanka-playgrounds/_shared` owns, and the text rules a list and a
 * `FlatList` agree on. The device application imports this barrel and only this
 * one; `./dom` is the half it cannot compile.
 */
export { formatAtlasMissionLine } from "./Core/Missions/formatAtlasMissionLine";
export { useAtlasHydratedMissions } from "./Modules/AtlasMissionsModule/useAtlasHydratedMissions";
export { useAtlasMissions } from "./Modules/AtlasMissionsModule/useAtlasMissions";
export { useAtlasMissionsOnMount } from "./Modules/AtlasMissionsModule/useAtlasMissionsOnMount";

export type { TAtlasMissionsVM } from "./Modules/AtlasMissionsModule/useAtlasMissions";
export type { TAtlasWritableMissionsVM } from "./Modules/AtlasMissionsModule/useAtlasHydratedMissions";
