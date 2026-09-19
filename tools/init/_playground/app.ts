/**
 * The playground's entry point: the one path a scene starts from.
 *
 * A project as one actually arrives — made by somebody else's scaffolder, with a
 * manifest, a lockfile, a bundler config and a tsconfig already in it — because
 * that is the project this command exists for. An empty directory is the easy
 * case and the scenes prove it second.
 */
export { createPlaygroundProject } from "./create-playground-project/createPlaygroundProject";
export { playgroundRoot } from "./playground-root/playgroundRoot";
