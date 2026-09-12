import { lankaZodValidator } from "@lankajs/zod";
import { lankaYupValidator } from "@lankajs/yup";
import { lankaTypeBoxValidator } from "@lankajs/typebox";
import { lankaEffectValidator } from "@lankajs/effect";
import { Struct } from "superstruct";
import { createLankaAnySchemaValidator } from "../../src/index";
import { createPlaygroundSuperstructValidator } from "../create-playground-superstruct-validator/createPlaygroundSuperstructValidator";

/**
 * The one validator this application hands to every gateway.
 *
 * Four registrations for six libraries, and that is not a shortcut: zod, valibot
 * and arktype are the same DIALECT — a synchronous Standard Schema — so one
 * entry serves all three. `lankaZodValidator` is the one written here because
 * zod is the library this application chose; `lankaValibotValidator` or
 * `lankaArkTypeValidator` would serve exactly as well, and the playground's
 * tests validate valibot and arktype schemas through this same entry.
 *
 * The other three each exist because their library cannot reach the port
 * otherwise: yup's Standard Schema is asynchronous, TypeBox publishes none, and
 * Effect's is behind a function.
 *
 * Plus one the framework has never heard of. superstruct has no package in
 * `modules/validators/` and the built-in table is right to call its schemas
 * unknown — recognising a library nobody registered would be guessing. So the
 * application registers it, and nothing in lanka had to change.
 *
 * The custom list is asked FIRST, which is also how a built-in dialect would be
 * overridden: a validator wrapped with logging, registered under a predicate
 * that recognises TypeBox, wins over the shipped one.
 *
 * Declared ONCE, at module level, like every schema it validates. The typebox
 * and effect validators cache per schema, and a hub rebuilt per render would
 * hand them schemas that are new objects each time.
 */
export const playgroundAppValidator = createLankaAnySchemaValidator({
	standard: lankaZodValidator,
	yup: lankaYupValidator,
	typebox: lankaTypeBoxValidator,
	effect: lankaEffectValidator,
	custom: [
		{
			name: "superstruct",
			// `instanceof` is right HERE and nowhere else in this repository:
			// superstruct puts no marker on a schema, and `Struct` is what it has.
			// The risk it carries — a duplicate copy of the library in the tree — is
			// the application's to weigh, and it owns its own lockfile.
			accepts: (schema: unknown) => schema instanceof Struct,
			validator: createPlaygroundSuperstructValidator(),
		},
	],
});
