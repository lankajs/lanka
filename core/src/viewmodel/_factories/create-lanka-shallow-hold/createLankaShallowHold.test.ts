import { describe, expect, it } from "vitest";
import { createLankaShallowHold } from "./createLankaShallowHold";

/**
 * The comparison that makes a selector mean something, held to its own policy.
 *
 * What a binding does with the answer is the binding's business and the
 * conformance suite's; what is asked here is only the policy — one level deep,
 * own keys, `Object.is` on each — and the identity that carries it. An identity
 * that moves when nothing moved is a re-render in all five bindings, and one
 * that stands still when something DID move is a frozen screen, so both
 * directions are scenes.
 *
 * These assertions were `@lankajs/react`'s until the capability moved to core.
 * They belong beside the unit now, because four other bindings depend on the
 * same answers and none of them imports React.
 */
interface IMission {
	title: string;
	status: string;
	unrelated: number;
}

const mission = (over: Partial<IMission> = {}): IMission => ({
	title: "survey",
	status: "queued",
	unrelated: 0,
	...over,
});

describe("what it holds", () => {
	it("answers the SAME object when every key matched", () => {
		// The whole point: a reader compares by identity, so holding the identity
		// is what turns "nothing I selected moved" into "do not wake me".
		const hold = createLankaShallowHold<{ title: string }>();
		const first = hold({ title: mission().title });

		const second = hold({ title: mission({ unrelated: 9 }).title });

		expect(second).toBe(first);
	});

	it("answers the NEW object when a key moved", () => {
		const hold = createLankaShallowHold<{ title: string }>();
		const first = hold({ title: "survey" });

		const second = hold({ title: "map the delta" });

		expect(second).not.toBe(first);
		expect(second).toEqual({ title: "map the delta" });
	});

	it("keeps holding the newest answer, not the first", () => {
		// A hold that compared against its ORIGINAL answer would go stale the
		// moment anything changed twice, and the second change would be invisible.
		const hold = createLankaShallowHold<{ title: string }>();
		hold({ title: "survey" });
		const second = hold({ title: "map the delta" });

		const third = hold({ title: "map the delta" });

		expect(third).toBe(second);
	});

	it("compares arrays too, because a selection is usually one", () => {
		const hold = createLankaShallowHold<string[]>();
		const first = hold([mission().title, mission().status]);

		expect(hold([mission({ unrelated: 1 }).title, mission().status])).toBe(first);
		expect(hold([mission().title, mission({ status: "active" }).status])).not.toBe(first);
	});

	it("notices a key appearing or disappearing", () => {
		// Same values, different arity. A comparison that walked only the LEFT
		// object's keys would call these equal and freeze a screen whose selector
		// grew a field.
		const hold = createLankaShallowHold<Record<string, unknown>>();
		const first = hold({ title: "survey" });

		expect(hold({ title: "survey", status: "queued" })).not.toBe(first);
	});

	it("notices a key RENAMED to one holding the same value", () => {
		// Equal length, equal values, different names — the case a count-and-values
		// comparison passes and a key-by-key one refuses.
		const hold = createLankaShallowHold<Record<string, unknown>>();
		const first = hold({ title: "survey" });

		expect(hold({ status: "survey" })).not.toBe(first);
	});
});

describe("what it deliberately does not hold", () => {
	it("is ONE level deep, and says so by failing on a nested change", () => {
		// Deeper would mean walking a state of unknown size on every read, which is
		// the cost a reader took a selector to avoid.
		const hold = createLankaShallowHold<{ nested: { title: string } }>();
		const first = hold({ nested: { title: "survey" } });

		expect(hold({ nested: { title: "survey" } })).not.toBe(first);
	});

	it("passes a primitive straight through", () => {
		// The shape that never had the problem. It must not become slower or
		// stranger for having a hold available.
		const hold = createLankaShallowHold<string>();

		expect(hold("survey")).toBe("survey");
		expect(hold("map the delta")).toBe("map the delta");
	});

	it("tells `undefined` apart from having held nothing yet", () => {
		// A selection may legitimately BE `undefined` — `(state) => state.selected`
		// before anything is selected. A hold keyed on "have I got one" rather than
		// on the value skips the first comparison for ever and holds nothing.
		const hold = createLankaShallowHold<Record<string, unknown> | undefined>();

		expect(hold(undefined)).toBeUndefined();

		const first = hold({ title: "survey" });

		expect(hold({ title: "survey" })).toBe(first);
	});

	it("gives every hold its own memory", () => {
		// One reader's selection is not another's. A hold shared between two
		// readers would answer the first one's object to the second.
		const one = createLankaShallowHold<{ title: string }>();
		const two = createLankaShallowHold<{ title: string }>();

		const held = one({ title: "survey" });

		expect(two({ title: "survey" })).not.toBe(held);
	});

	it("refuses `null` against an object, rather than walking it", () => {
		const hold = createLankaShallowHold<Record<string, unknown> | null>();
		const first = hold(null);

		expect(hold({ title: "survey" })).not.toBe(first);
		expect(hold(null)).toBeNull();
	});
});
