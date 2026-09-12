import { describe, expect, it } from "vitest";
import { lankaStandardValidator } from "lanka/validation";
import { lankaZodValidator } from "@lankajs/zod";
import { lankaValibotValidator } from "@lankajs/valibot";
import { lankaArkTypeValidator } from "@lankajs/arktype";
import { lankaYupValidator } from "@lankajs/yup";
import { lankaTypeBoxValidator } from "@lankajs/typebox";
import { lankaEffectValidator } from "@lankajs/effect";
import { createLankaAnySchemaValidator, lankaSchemaDialect } from "../src/index";
import {
	createPlaygroundGateway,
	playgroundAnalyticsSchema,
	playgroundAppValidator,
	playgroundAuditSchema,
	playgroundBillingSchema,
	playgroundFeatureFlagSchema,
	playgroundOrderSchema,
	playgroundProfileSchema,
	playgroundProtocolSchema,
	playgroundShippingSchema,
	playgroundBatchSchema,
} from "./app";
import type { IPlaygroundProtocolFrame } from "./app";

/**
 * Six schema libraries in one application, through one gateway.
 *
 * Every other package in `modules/validators/` is exercised alone, which is how
 * an application should use them. This one is exercised MIXED, because mixing is
 * what actually happens and "it probably works" is not a test.
 */

/** Every library in the family, with a schema and a body that satisfies it. */
const features = [
	{
		library: "zod",
		dialect: "standard",
		schema: playgroundOrderSchema,
		valid: { id: "o-1", total: 20, lines: [{ sku: "A", qty: 2 }] },
		invalid: { id: "o-1", total: 20, lines: [{ sku: "A", qty: 0 }] },
	},
	{
		library: "valibot",
		dialect: "standard",
		schema: playgroundAuditSchema,
		valid: { actor: "ada", action: "login" },
		invalid: { actor: 1, action: "login" },
	},
	{
		library: "arktype",
		dialect: "standard",
		schema: playgroundFeatureFlagSchema,
		valid: { key: "new-checkout", enabled: true },
		invalid: { key: "new-checkout", enabled: "yes" },
	},
	{
		library: "yup",
		dialect: "yup",
		schema: playgroundProfileSchema,
		valid: { handle: "ada", age: 36 },
		invalid: { handle: "ada", age: 15 },
	},
	{
		library: "TypeBox",
		dialect: "typebox",
		schema: playgroundBillingSchema,
		valid: { invoice: "i-1", amountCents: 1200, currency: "EUR" },
		invalid: { invoice: "i-1", amountCents: -1, currency: "EUR" },
	},
	{
		library: "Effect",
		dialect: "effect",
		schema: playgroundAnalyticsSchema,
		valid: { event: "checkout", at: 1 },
		invalid: { event: "checkout", at: "now" },
	},
] as const;

describe("one gateway, six libraries", () => {
	for (const feature of features) {
		it(`reads a ${feature.library} body and returns the parsed value`, () => {
			const gateway = createPlaygroundGateway();

			expect(
				gateway.read({ schema: feature.schema, context: feature.library }, feature.valid),
			).toMatchObject(feature.valid);
		});

		it(`refuses a bad ${feature.library} body, naming the call`, () => {
			const gateway = createPlaygroundGateway();

			expect(() =>
				gateway.read(
					{ schema: feature.schema, context: `${feature.library}.read` },
					feature.invalid,
				),
			).toThrowError(new RegExp(`${feature.library}\\.read`));
		});

		it(`hands a ${feature.library} failure back as messages on the form path`, () => {
			const gateway = createPlaygroundGateway();

			const result = gateway.submit(
				{ schema: feature.schema, context: feature.library },
				feature.invalid,
			);

			expect(result.success).toBe(false);
			if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
		});
	}

	it("keeps the dialects apart across interleaved calls", () => {
		// The failure this guards against: a hub that decided the dialect once, or
		// cached it against anything but the schema, would serve the second library
		// with the first one's validator and only fail on some orderings.
		const gateway = createPlaygroundGateway();

		for (let round = 0; round < 3; round += 1) {
			for (const feature of features) {
				expect(
					gateway.read(
						{ schema: feature.schema, context: feature.library },
						feature.valid,
					),
				).toMatchObject(feature.valid);
			}
		}
	});
});

describe("the dialect table agrees with the real libraries", () => {
	/*
	 * The one thing that could rot silently.
	 *
	 * `lankaSchemaDialect` reads markers by shape, and each vendor package has its
	 * own guard reading the same marker. If a library changes what it puts on a
	 * schema, the two could disagree — the hub routing confidently to a validator
	 * that then refuses. Asserting both halves here is what makes that a failing
	 * test rather than a support ticket.
	 */
	for (const feature of features) {
		it(`calls a ${feature.library} schema "${feature.dialect}"`, () => {
			expect(lankaSchemaDialect(feature.schema)).toBe(feature.dialect);
		});
	}

	it("routes every schema to a validator that accepts it", () => {
		const validators = {
			standard: lankaZodValidator,
			yup: lankaYupValidator,
			typebox: lankaTypeBoxValidator,
			effect: lankaEffectValidator,
		} as const;

		for (const feature of features) {
			const validator = validators[feature.dialect];

			// Called DIRECTLY, bypassing the hub: this asserts the vendor package's
			// own guard agrees with the table, rather than that the hub is
			// self-consistent.
			expect(() =>
				(validator as { validate: (s: never, d: unknown, c: string) => unknown }).validate(
					feature.schema as never,
					feature.valid,
					feature.library,
				),
			).not.toThrow();
		}
	});
});

describe("what an application does wrong, and what it is told", () => {
	it("names the package to install when a dialect is unregistered", () => {
		// The scene: a team adds the billing SDK and wires the hub before reading
		// its README.
		const partial = createLankaAnySchemaValidator({ standard: lankaZodValidator });

		expect(() => partial.validate(playgroundBillingSchema, {}, "billing")).toThrowError(
			/@lankajs\/typebox/,
		);
	});

	it("refuses a yup schema handed straight to core, and says which package to use", () => {
		// Before `@lankajs/yup` existed this was the whole failure mode, and the
		// message said only "asynchronous" — which reads as "your schema is wrong".
		expect(() =>
			lankaStandardValidator.validate(
				playgroundProfileSchema as unknown as Parameters<
					typeof lankaStandardValidator.validate
				>[0],
				{ handle: "ada", age: 36 },
				"profile",
			),
		).toThrowError(/@lankajs\/yup/);
	});

	it("refuses a TypeBox schema handed to the zod validator, naming the mismatch", () => {
		expect(() =>
			lankaZodValidator.validateSafe(
				playgroundBillingSchema as unknown as Parameters<
					typeof lankaZodValidator.validateSafe
				>[0],
				{},
			),
		).toThrowError(/not a zod schema/i);
	});

	it("refuses an Effect schema handed to the TypeBox validator", () => {
		expect(() =>
			lankaTypeBoxValidator.validateSafe(
				playgroundAnalyticsSchema as unknown as Parameters<
					typeof lankaTypeBoxValidator.validateSafe
				>[0],
				{},
			),
		).toThrowError(/not a TypeBox schema/i);
	});

	it("never lets a raw library error escape, for any pairing of the six", () => {
		/*
		 * The matrix. Before the guards, five of the six validators threw a raw
		 * `TypeError` out of `validateSafe` — a method that promises to throw
		 * nothing the data caused — with messages like "schema.safeParse is not a
		 * function" that named the wrong library.
		 *
		 * Nothing here may accept a foreign schema, and nothing may fail with an
		 * error a consumer cannot act on.
		 */
		const validators = [
			["zod", lankaZodValidator],
			["valibot", lankaValibotValidator],
			["arktype", lankaArkTypeValidator],
			["yup", lankaYupValidator],
			["typebox", lankaTypeBoxValidator],
			["effect", lankaEffectValidator],
		] as const;

		for (const [name, validator] of validators) {
			for (const feature of features) {
				const call = () =>
					(
						validator as {
							validateSafe: (s: never, d: unknown) => { success: boolean };
						}
					).validateSafe(feature.schema as never, feature.invalid);

				let outcome: string;
				try {
					outcome = call().success ? "accepted" : "refused the value";
				} catch (error) {
					outcome =
						error instanceof Error && error.name === "LankaValidationError"
							? "refused the schema"
							: `RAW ${String((error as Error).name)}`;
				}

				expect(outcome, `${name} <- ${feature.library}`).not.toBe("accepted");
				expect(outcome, `${name} <- ${feature.library}`).not.toMatch(/^RAW /);
			}
		}
	});

	it("lets the three Standard Schema libraries validate each other, which is not a bug", () => {
		// zod, valibot and arktype are one dialect. An application mixing only those
		// three needs no hub at all, and this is the test that says so.
		const bodies = [
			[playgroundOrderSchema, { id: "o-1", total: 1, lines: [] }],
			[playgroundAuditSchema, { actor: "ada", action: "login" }],
			[playgroundFeatureFlagSchema, { key: "k", enabled: false }],
		] as const;

		for (const [schema, body] of bodies) {
			for (const validator of [
				lankaZodValidator,
				lankaValibotValidator,
				lankaArkTypeValidator,
			]) {
				expect(
					validator.validate(
						schema as unknown as Parameters<typeof validator.validate>[0],
						body,
						"cross",
					),
				).toMatchObject(body);
			}
		}
	});

	it("is still one validator per application, however many dialects it holds", () => {
		// The hub is a module-level value. A second one is not wrong, it is just
		// another thing to keep in step — and the playground says so by having one.
		expect(playgroundAppValidator).toBe(playgroundAppValidator);
		expect(Object.isFrozen(playgroundAppValidator)).toBe(true);
	});
});

describe("a library lanka has never heard of", () => {
	/**
	 * superstruct, registered by the application as a custom dialect.
	 *
	 * The scene that decides whether the extension point is real: nothing in
	 * `src/` knows superstruct exists, and the gateway serves it beside the six.
	 */
	const shipping = { schema: playgroundShippingSchema, context: "shipping.quote" };

	it("is unknown to the built-in table, and rightly so", () => {
		// Recognising a library nobody registered would be guessing, and a guess
		// that happens to work is a guess that stops working on an upgrade.
		expect(lankaSchemaDialect(playgroundShippingSchema)).toBe("unknown");
	});

	it("is read by the same gateway as the other six", () => {
		const gateway = createPlaygroundGateway();

		expect(gateway.read(shipping, { carrier: "DHL", days: 2, priceCents: 900 })).toEqual({
			carrier: "DHL",
			days: 2,
			priceCents: 900,
		});
	});

	it("refuses a bad body with the family's message shape, naming the call", () => {
		const gateway = createPlaygroundGateway();

		expect(() =>
			gateway.read(shipping, { carrier: "DHL", days: 0, priceCents: 900 }),
		).toThrowError(/shipping\.quote/);
	});

	it("reports the field path the way every other dialect does", () => {
		const gateway = createPlaygroundGateway();

		const result = gateway.submit(shipping, { carrier: 1, days: 2, priceCents: 900 });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors.join(" ")).toContain("carrier");
	});

	it("is refused by the vendor validators, since it belongs to none of them", () => {
		// The custom dialect is the ONLY thing that makes this schema work. Handed
		// to a shipped validator it is a foreign schema like any other.
		expect(() =>
			lankaZodValidator.validateSafe(
				playgroundShippingSchema as unknown as Parameters<
					typeof lankaZodValidator.validateSafe
				>[0],
				{},
			),
		).toThrowError(/not a zod schema/i);
	});
});

describe("a schema with no library behind it", () => {
	/**
	 * The partner's wire protocol, written with `createLankaSchema`.
	 *
	 * A Standard Schema built from a function, so the hub routes it as `standard`
	 * and the application pays nothing — no dependency, no registration.
	 */
	const protocol = { schema: playgroundProtocolSchema, context: "protocol.frame" };

	it("is the `standard` dialect, so it needed no registration at all", () => {
		expect(lankaSchemaDialect(playgroundProtocolSchema)).toBe("standard");
	});

	it("reads a frame and produces the application's own type", () => {
		const gateway = createPlaygroundGateway();

		const frame = gateway.read<IPlaygroundProtocolFrame>(protocol, {
			kind: "ping",
			seq: 7,
			at: "1700000000",
		});

		// The transform is the function's return: a string of seconds became a Date,
		// and `seq` became `sequence`. A mapping is a schema here too.
		expect(frame.kind).toBe("ping");
		expect(frame.sequence).toBe(7);
		expect(frame.sentAt).toEqual(new Date(1_700_000_000_000));
	});

	it("reports every broken rule at once, each at its own field", () => {
		const gateway = createPlaygroundGateway();

		const result = gateway.submit(protocol, { kind: "hello", seq: -1, at: "0" });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toHaveLength(3);
			expect(result.fields?.map((field) => field.path)).toEqual([["kind"], ["seq"], ["at"]]);
		}
	});

	it("gives a frame that is not an object the form's ROOT", () => {
		const gateway = createPlaygroundGateway();

		const result = gateway.submit(protocol, "not a frame");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.fields?.[0].path).toEqual([]);
	});

	it("names its own vendor, which is what a trace shows in a mixed application", () => {
		expect(playgroundProtocolSchema["~standard"].vendor).toBe("acme-protocol");
	});

	it("is read by the vendor validators too, because it really is Standard Schema", () => {
		// The claim in one line: a hand-written schema is not a second-class citizen.
		// An application using only zod can validate one with `lankaZodValidator`.
		expect(
			lankaZodValidator.validate(
				playgroundProtocolSchema as unknown as Parameters<
					typeof lankaZodValidator.validate
				>[0],
				{ kind: "pong", seq: 1, at: "1700000000" },
				"protocol",
			),
		).toMatchObject({ kind: "pong", sequence: 1 });
	});
});

describe("eight dialects through one gateway", () => {
	it("keeps all of them apart across interleaved calls", () => {
		// The six libraries, plus the registered one and the hand-written one. If
		// the hub cached a dialect against anything but the schema, this ordering is
		// what would expose it.
		const gateway = createPlaygroundGateway();

		const everything = [
			...features.map((feature) => [feature.schema, feature.valid] as const),
			[playgroundShippingSchema, { carrier: "DHL", days: 2, priceCents: 900 }] as const,
			[playgroundProtocolSchema, { kind: "ping", seq: 1, at: "1700000000" }] as const,
		];

		for (let round = 0; round < 3; round += 1) {
			for (const [schema, body] of everything) {
				expect(() => gateway.read({ schema, context: "round" }, body)).not.toThrow();
			}
		}
	});
});

describe("one promise, eight dialects", () => {
	/**
	 * The family's deepest claim, asserted ACROSS the libraries rather than against
	 * a specification.
	 *
	 * Each package's own playground runs the conformance suite, which proves it
	 * keeps the promise. Six packages each keeping it in their own process is not
	 * the same statement as "an application that swaps one for another sees the
	 * same failure" — and this is the only place where all of them are loaded at
	 * once, so it is the only place that statement can be made.
	 */
	const everything = [
		...features.map((feature) => ({
			library: feature.library,
			schema: feature.schema,
			invalid: feature.invalid,
		})),
		{
			library: "superstruct (registered)",
			schema: playgroundShippingSchema,
			invalid: { carrier: 1, days: 0, priceCents: -1 },
		},
		{
			library: "createLankaSchema (no library)",
			schema: playgroundProtocolSchema,
			invalid: { kind: "hello", seq: -1, at: "0" },
		},
	];

	const refusalOf = (schema: unknown, invalid: unknown) => {
		const result = createPlaygroundGateway().submit({ schema, context: "shape" }, invalid);

		if (result.success) throw new Error("expected a refusal");

		return result;
	};

	for (const { library, schema, invalid } of everything) {
		it(`${library}: reports at least one error, and never an empty list`, () => {
			// A refusal with no message is a refusal nobody can act on, and each
			// library has its own way of arriving at one.
			expect(refusalOf(schema, invalid).errors.length).toBeGreaterThan(0);
		});

		it(`${library}: answers with fields, one per error`, () => {
			// `fields` is OPTIONAL on the port, so a package may answer without it.
			// None of these does, and an application reading `fields` on one library
			// and `errors` on another is the migration the family exists to avoid.
			const result = refusalOf(schema, invalid);

			expect(result.fields, `${library} answers without fields`).toBeDefined();
			expect(result.fields).toHaveLength(result.errors.length);
		});

		it(`${library}: gives every field a path of plain segments`, () => {
			for (const field of refusalOf(schema, invalid).fields ?? []) {
				// A plain array — the arktype defect was a library's Array SUBCLASS
				// travelling out through the port, printing identically and comparing
				// unequal.
				expect(Object.getPrototypeOf(field.path), library).toBe(Array.prototype);

				for (const segment of field.path) {
					expect(["string", "number"], `${library} path ${String(field.path)}`).toContain(
						typeof segment,
					);
				}
			}
		});

		it(`${library}: writes each banner line as its own field's address`, () => {
			// The one format rule the whole family shares: `path: message`, or the
			// message alone when the value as a whole was refused.
			const result = refusalOf(schema, invalid);

			result.fields?.forEach((field, index) => {
				const line = result.errors[index];
				const path = field.path.join(".");

				if (path) expect(line, library).toBe(`${path}: ${field.message}`);
				else expect(line, library).toBe(field.message);
			});
		});
	}

	it("never puts an empty string where a form expects an input name", () => {
		// A path of `[""]` addresses an input named nothing. The root is an EMPTY
		// path, and the two are different places.
		for (const { library, schema, invalid } of everything) {
			for (const field of refusalOf(schema, invalid).fields ?? []) {
				expect(field.path, library).not.toContain("");
			}
		}
	});
});

describe("composing a hand-written schema without combinators", () => {
	/**
	 * `createLankaSchema` has no `array()`, and this is what it has instead.
	 *
	 * The batch and the single frame read with the SAME function, which takes a
	 * path prefix. That is the whole composition story the package offers, and the
	 * scene exists so the answer to "how do I reuse a shape" is executable rather
	 * than a paragraph.
	 */
	const batch = { schema: playgroundBatchSchema, context: "protocol.batch" };

	it("reads a list of frames with the function one frame uses", () => {
		const gateway = createPlaygroundGateway();

		const frames = gateway.read<IPlaygroundProtocolFrame[]>(batch, [
			{ kind: "ping", seq: 1, at: "1700000000" },
			{ kind: "pong", seq: 2, at: "1700000001" },
		]);

		expect(frames.map((frame) => frame.sequence)).toEqual([1, 2]);
		expect(frames[1].sentAt).toEqual(new Date(1_700_000_001_000));
	});

	it("addresses a bad frame by its INDEX, not by the field alone", () => {
		// Without the prefix a batch of twenty reports twenty failures at the same
		// address and the form has nowhere to put nineteen of them.
		const result = createPlaygroundGateway().submit(batch, [
			{ kind: "ping", seq: 1, at: "1700000000" },
			{ kind: "ping", seq: 2, at: "1700000001" },
			{ kind: "hello", seq: 3, at: "1700000002" },
		]);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.fields?.[0].path).toEqual([2, "kind"]);
			expect(result.errors[0]).toContain("2.kind");
		}
	});

	it("reports EVERY failing frame, not the first", () => {
		const result = createPlaygroundGateway().submit(batch, [
			{ kind: "hello", seq: 1, at: "1700000000" },
			{ kind: "pong", seq: -1, at: "1700000001" },
		]);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.fields?.map((field) => field.path)).toEqual([
				[0, "kind"],
				[1, "seq"],
			]);
		}
	});

	it("refuses a batch that is not a list, at the ROOT", () => {
		const result = createPlaygroundGateway().submit(batch, { kind: "ping" });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.fields?.[0].path).toEqual([]);
	});

	it("accepts an empty batch, because no frames is not a broken frame", () => {
		expect(createPlaygroundGateway().read<IPlaygroundProtocolFrame[]>(batch, [])).toEqual([]);
	});

	it("is the same dialect as everything else, so the gateway needed no change", () => {
		expect(lankaSchemaDialect(playgroundBatchSchema)).toBe("standard");
	});
});
