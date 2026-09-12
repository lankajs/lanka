import { lankaStandardValidator } from "lanka/validation";
import type { ILankaValidator } from "lanka/validation";

/**
 * The validator for arktype schemas.
 *
 * This is `lankaStandardValidator` under a name that says which library it is
 * for: arktype implements Standard Schema synchronously and there is nothing to
 * translate. The name exists so an application's code shows what it validates
 * with.
 *
 * The same shape as `@lankajs/valibot`, and for the same reason — the library
 * already speaks the protocol. Where a package in this family is thicker, the
 * library made it so: see `@lankajs/yup`, whose Standard Schema implementation is
 * asynchronous and therefore unusable through a synchronous port.
 */
export const lankaArkTypeValidator: ILankaValidator = lankaStandardValidator;
