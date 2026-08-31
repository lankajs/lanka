/**
 * The same sign-up form as `@lankajs/zod`'s playground, in valibot.
 *
 * Deliberately the same shape and the same file layout: the two packages promise
 * interchangeability, and the cheapest way to keep that true is for both to
 * answer the same questions in the same places.
 */
export { createPlaygroundForm } from "./create-playground-form/createPlaygroundForm";
export { playgroundSignUpSchema } from "./playground-sign-up-schema/playgroundSignUpSchema";
export { playgroundApiShapeSchema } from "./playground-api-shape-schema/playgroundApiShapeSchema";
export { playgroundToApiSchema } from "./playground-to-api-schema/playgroundToApiSchema";
export type { TPlaygroundSignUp } from "./playground-sign-up-schema/playgroundSignUpSchema";
export type { IPlaygroundFormState } from "./_interfaces/IPlaygroundFormState";
