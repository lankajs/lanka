import { describe, expect, it } from "vitest";
import { lankaValidatorConformance } from "@lankajs/tool-testing/lankaValidatorConformance";
import { lankaYupValidator } from "../src/index";
import {
	createPlaygroundProfileScreen,
	playgroundApiShapeSchema,
	playgroundSignUpSchema,
	playgroundToApiSchema,
} from "./app";

/**
 * The package, used as an application uses it.
 *
 * What matters is not that yup validates — yup's own tests cover that — but that
 * a yup schema passes through the framework's validator port intact, and that a
 * failure arrives as something a screen can put next to an input.
 *
 * Those assertions are the family's, so they are imported rather than written
 * here: six packages promising the same thing in six copies of one test file is
 * six chances for one of them to quietly stop promising it.
 */
lankaValidatorConformance({
	vendor: "yup",
	validator: lankaYupValidator,
	signUp: playgroundSignUpSchema,
	apiShape: playgroundApiShapeSchema,
	toApi: playgroundToApiSchema,
});

const valid = { email: "ada@example.com", age: 36, tags: [{ id: 1 }] };

describe("the yup playground's profile screen", () => {
	it("keeps the parsed value after a valid submission", () => {
		const screen = createPlaygroundProfileScreen();

		expect(screen.submit(valid)).toBe(true);
		expect(screen.state.value?.email).toBe("ada@example.com");
	});

	it("indexes a message by the address of the input it belongs to", () => {
		// yup says `tags[0].id`; the bridge hands back `["tags", 0, "id"]`; the
		// screen joins them ITSELF, which is the only direction that is safe.
		const screen = createPlaygroundProfileScreen();

		screen.submit({ ...valid, tags: [{ id: "one" }] });

		expect(Object.keys(screen.state.messages)).toContain("tags.0.id");
	});

	it("puts a message per input, not one list for the whole screen", () => {
		const screen = createPlaygroundProfileScreen();

		screen.submit({ email: "not-an-email", age: 15, tags: [] });

		expect(Object.keys(screen.state.messages).sort()).toEqual(["age", "email"]);
	});

	it("sends a refusal with no address to the form's root", () => {
		// `yup.number().min(18)` refusing a bare 3 reports no path at all. An input
		// named "" is not a place; the root is.
		const screen = createPlaygroundProfileScreen();

		screen.submit("not an object");

		expect(Object.keys(screen.state.messages)).toEqual(["form"]);
	});

	it("clears every message once a submission succeeds", () => {
		const screen = createPlaygroundProfileScreen();

		screen.submit({ ...valid, age: 15 });
		screen.submit(valid);

		expect(screen.state.messages).toEqual({});
	});

	it("works through the SAME schema core's port refuses outright", () => {
		// The package's reason for existing, in the playground rather than only in a
		// unit test: this is the scene an adopter arrives with.
		expect(playgroundSignUpSchema["~standard"].validate({})).toBeInstanceOf(Promise);
		expect(createPlaygroundProfileScreen().submit(valid)).toBe(true);
	});
});
