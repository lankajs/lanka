import { createLankaAnySchemaValidator } from "@lankajs/any-schema";
import { lankaEffectValidator } from "@lankajs/effect";
import { lankaTypeBoxValidator } from "@lankajs/typebox";
import { lankaYupValidator } from "@lankajs/yup";
import { lankaZodValidator } from "@lankajs/zod";

/**
 * One validator for every schema this application has, whatever wrote it.
 *
 * **Read the warning before copying this.** One application, one schema library
 * is the advice every package in `modules/validators/` gives, and it does not
 * change because this hub exists. Atlas mixes on purpose, because a playground
 * that used one library could not show what the other three cost — and because
 * the mixed case is the one that arrives with a merger, a vendored SDK or a
 * screen older than the decision.
 *
 * `standard` covers zod, valibot and arktype together: they are one dialect, and
 * registering three entries for them would suggest they are three.
 *
 * What it costs is visible in every call site: `validate` cannot infer an output
 * type across four dialects, so the type is named — `validate<IAtlasMission>(…)`.
 * With one library that type would have been free.
 */
export const atlasValidator = createLankaAnySchemaValidator({
	standard: lankaZodValidator,
	yup: lankaYupValidator,
	typebox: lankaTypeBoxValidator,
	effect: lankaEffectValidator,
});
