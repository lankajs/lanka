/**
 * A consumer's project, from empty directory to wired build.
 *
 * Adopting the framework must cost one plugin entry, and proving that is a
 * SEQUENCE across a real filesystem — scaffold, verify, configure — which is why
 * it cannot be a unit test.
 */
export { startPlaygroundProject } from "./start-playground-project/startPlaygroundProject";
export { requiredBarrels } from "./required-barrels/requiredBarrels";
export { playgroundTsconfig } from "./playground-tsconfig/playgroundTsconfig";
export type {
	IPlaygroundCliRun,
	IPlaygroundProject,
	IPlaygroundProjectOptions,
} from "./_interfaces/IPlaygroundProject";
