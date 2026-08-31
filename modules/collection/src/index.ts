/**
 * `@lankajs/collection` — lists a screen reads.
 *
 * Sorting a list is four lines. What this package is for is what happens next: a
 * new array every render is a new prop for every row, and a table with two
 * hundred of them repaints because somebody typed into a filter somewhere else.
 *
 * So every operation answers with the array it was GIVEN when nothing changed,
 * and `stabilise` goes further — it keeps the row OBJECTS across a refetch that
 * returned identical data.
 *
 * No dependency on `lanka`: a list does not need a framework.
 */

export { createLankaCollectionView } from "./_factories/create-lanka-collection-view/createLankaCollectionView";
export type { ILankaCollectionViewConfig } from "./_factories/create-lanka-collection-view/createLankaCollectionView";

export { nextLankaSortState } from "./next-lanka-sort-state/nextLankaSortState";
export { compareLankaValues } from "./compare-lanka-values/compareLankaValues";
export { lankaFilterMatchers } from "./lanka-filter-matchers/lankaFilterMatchers";

export type { ILankaFilterRule } from "./_interfaces/ILankaFilterRule";
export type { ILankaPage } from "./_interfaces/ILankaPage";
export type { ILankaSortState } from "./_interfaces/ILankaSortState";
export type { TLankaFilterMatcher } from "./_types/TLankaFilterMatcher";
export type { TLankaFilterOperator } from "./_types/TLankaFilterOperator";
export type { TLankaSortableValue } from "./_types/TLankaSortableValue";
export type { TLankaSortOrder } from "./_types/TLankaSortOrder";
export type { TLankaValueReader } from "./_types/TLankaValueReader";
