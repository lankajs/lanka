/**
 * A consumer's project, from empty directory to wired build.
 *
 * Adopting the framework must cost one plugin entry, and proving that is a
 * SEQUENCE across a real filesystem — scaffold, verify, configure — which is why
 * it cannot be a unit test.
 */
export { startPlaygroundProject } from "./start-playground-project/startPlaygroundProject";
export { requiredBarrels } from "./required-barrels/requiredBarrels";
export { PLAYGROUND_TSCONFIG } from "./playground-tsconfig/PLAYGROUND_TSCONFIG";
export type { IPlaygroundProject } from "./_interfaces/IPlaygroundProject";
