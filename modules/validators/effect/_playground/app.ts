/**
 * Start-up configuration, read the way an application reads it.
 *
 * The package's whole job is that a schema written in Effect — which carries no
 * `~standard` of its own — reaches the framework's validator port, and that its
 * failures arrive as field paths a form can attach to inputs.
 *
 * A CONFIG READER rather than a form, and that is deliberate across the family:
 * each package is shown in a different consumer shape. This one is Effect's own
 * story — a plain function returning a plain value, with no runtime started.
 */
export { readPlaygroundConfig } from "./read-playground-config/readPlaygroundConfig";
export { playgroundConfigSchema } from "./playground-config-schema/playgroundConfigSchema";
export { playgroundSignUpSchema } from "./playground-sign-up-schema/playgroundSignUpSchema";
export { playgroundApiShapeSchema } from "./playground-api-shape-schema/playgroundApiShapeSchema";
export { playgroundToApiSchema } from "./playground-to-api-schema/playgroundToApiSchema";
export type { TPlaygroundSignUp } from "./playground-sign-up-schema/playgroundSignUpSchema";
export type { IPlaygroundConfig } from "./_interfaces/IPlaygroundConfig";
