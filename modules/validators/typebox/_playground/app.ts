/**
 * A sign-up form validated the way an application validates one.
 *
 * The package's whole job is that a schema written in TypeBox is accepted by the
 * framework's validator port and that its failures arrive as field paths a form
 * can attach to inputs. The schema is its own file because it is the part a
 * consumer replaces.
 */
export { createPlaygroundForm } from "./create-playground-form/createPlaygroundForm";
export { playgroundSignUpSchema } from "./playground-sign-up-schema/playgroundSignUpSchema";
export { playgroundApiShapeSchema } from "./playground-api-shape-schema/playgroundApiShapeSchema";
export { playgroundToApiSchema } from "./playground-to-api-schema/playgroundToApiSchema";
export type { TPlaygroundSignUp } from "./playground-sign-up-schema/playgroundSignUpSchema";
export type { IPlaygroundFormState } from "./_interfaces/IPlaygroundFormState";
