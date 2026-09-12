/**
 * A profile screen, validated the way an application validates one.
 *
 * The package's whole job is that a schema written in yup — every one of which
 * core's port refuses, because yup's Standard Schema is asynchronous — is
 * validated synchronously, and that its failures arrive as field paths a screen
 * can attach to inputs.
 *
 * A SCREEN indexing messages by path rather than a form listing them, and that
 * is deliberate across the family: each package is shown in a different consumer
 * shape. This one is yup's own story — it is the library whose paths are
 * bracketed, and segments are what the bridge exists to produce.
 */
export { createPlaygroundProfileScreen } from "./create-playground-profile-screen/createPlaygroundProfileScreen";
export { playgroundSignUpSchema } from "./playground-sign-up-schema/playgroundSignUpSchema";
export { playgroundApiShapeSchema } from "./playground-api-shape-schema/playgroundApiShapeSchema";
export { playgroundToApiSchema } from "./playground-to-api-schema/playgroundToApiSchema";
export type { TPlaygroundSignUp } from "./playground-sign-up-schema/playgroundSignUpSchema";
export type { IPlaygroundScreenState } from "./_interfaces/IPlaygroundScreenState";
