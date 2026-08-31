/**
 * A table screen: search, sort by a header, page through what is left.
 *
 * The package is about what a screen does NOT get — a new array, a new row
 * object — so the scenes assert on references as often as on order.
 */
export { createPlaygroundEmployeeList } from "./create-playground-employee-list/createPlaygroundEmployeeList";
export { createPlaygroundEmployees } from "./create-playground-employees/createPlaygroundEmployees";
export { playgroundHiredBeforeMatchers } from "./playground-hired-before-matchers/playgroundHiredBeforeMatchers";
export type { IPlaygroundEmployee } from "./_interfaces/IPlaygroundEmployee";
