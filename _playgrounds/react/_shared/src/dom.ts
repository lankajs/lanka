/**
 * Atlas for React — the half that needs a document.
 *
 * A separate entry and not part of the barrel, because of one real failure:
 * React Native's types replace the JSX intrinsic elements, so `<input>` is not a
 * thing in the device application's program. Importing a barrel that reached one
 * component holding an `<input>` pulled the whole file into that program and the
 * typecheck failed on a component nobody had rendered.
 *
 * So the split is by what a RENDERER can do, not by what a folder is called, and
 * the manifest's `exports` is where it is enforced.
 */
export { AtlasMissionSearch } from "./Modules/AtlasMissionsModule/AtlasMissionSearch";

export type { IAtlasMissionSearchProps } from "./Modules/AtlasMissionsModule/AtlasMissionSearch";
