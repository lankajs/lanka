/**
 * A feature-flag gateway, validated the way an application validates one.
 *
 * The package's whole job is that a schema written in arktype is accepted by the
 * framework's validator port and that its failures arrive as field paths a form
 * can attach to inputs. The schemas are their own files because they are the
 * part a consumer replaces.
 *
 * A GATEWAY rather than a form, and that is deliberate across the family: each
 * package is shown in a different consumer shape, so six playgrounds teach six
 * things instead of one thing six times.
 */
export { createPlaygroundFeatureGateway } from "./create-playground-feature-gateway/createPlaygroundFeatureGateway";
export { playgroundFlagSchema } from "./playground-flag-schema/playgroundFlagSchema";
export { playgroundSignUpSchema } from "./playground-sign-up-schema/playgroundSignUpSchema";
export { playgroundApiShapeSchema } from "./playground-api-shape-schema/playgroundApiShapeSchema";
export { playgroundToApiSchema } from "./playground-to-api-schema/playgroundToApiSchema";
export type { TPlaygroundSignUp } from "./playground-sign-up-schema/playgroundSignUpSchema";
export type { IPlaygroundFeatureFlag } from "./_interfaces/IPlaygroundFeatureFlag";
