/**
 * A start-up sequence with the two things core's bootstrap cannot express: a
 * context each step reads from the previous one, and an early exit that is a
 * DECISION rather than a failure.
 *
 * The application: restore a session, load a profile, decide where the user
 * lands. An unauthenticated visitor never reaches the profile step, and that is
 * not an error anywhere. One file per step, so a step is read without the
 * sequence and the sequence is read without the steps.
 */
export { createPlaygroundBootstrap } from "./create-playground-bootstrap/createPlaygroundBootstrap";
export { startPlaygroundBootstrap } from "./start-playground-bootstrap/startPlaygroundBootstrap";
export type { IPlaygroundBootstrapApp } from "./start-playground-bootstrap/startPlaygroundBootstrap";
export type { IPlaygroundBackend } from "./_interfaces/IPlaygroundBackend";
export type { IPlaygroundContext } from "./_interfaces/IPlaygroundContext";
