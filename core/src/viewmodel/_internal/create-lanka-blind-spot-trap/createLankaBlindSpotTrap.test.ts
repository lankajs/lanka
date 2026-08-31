import { afterEach, describe, expect, it, vi } from "vitest";
import { createLankaBlindSpotTrap } from "./createLankaBlindSpotTrap";

/**
 * The trap that catches a key linked to a component through a getter.
 *
 * Two properties matter most and neither is visible from a ViewModel test: that
 * a DISARMED trap is identity everywhere — otherwise production pays for a
 * development tool — and that it warns only about the case it exists for.
 */
afterEach(() => {
	vi.restoreAllMocks();
});

const warned = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);

describe("createLankaBlindSpotTrap — disarmed", () => {
	it("hands back the same `get`, unwrapped", () => {
		const trap = createLankaBlindSpotTrap("VM", false);
		const get = () => ({ a: 1 });

		expect(trap.observeGet(get)).toBe(get);
	});

	it("hands back the same actions, unwrapped", () => {
		const trap = createLankaBlindSpotTrap("VM", false);
		const actions = { load: vi.fn() };

		expect(trap.observeActions(actions)).toBe(actions);
	});

	it("reports nothing", () => {
		const warn = warned();
		const trap = createLankaBlindSpotTrap("VM", false);

		trap.report(new Set(["a"]), { b: 2 }, { b: 1 });

		expect(warn).not.toHaveBeenCalled();
		expect(trap.isArmed).toBe(false);
	});
});

describe("createLankaBlindSpotTrap — armed", () => {
	/** A ViewModel whose action reads `hidden` through `get()`. */
	const trapReading = (readKey: string) => {
		const trap = createLankaBlindSpotTrap("VM", true);
		const state = { visible: 1, hidden: 2 } as Record<string, unknown>;
		const observedGet = trap.observeGet(() => state);

		const actions = trap.observeActions({
			run: () => {
				const current = observedGet();
				return current[readKey];
			},
		});

		actions.run();
		return trap;
	};

	it("warns when a changed key is reachable only through a getter", () => {
		const warn = warned();
		const trap = trapReading("hidden");

		// The component tracked `run`; the action read `hidden` behind it.
		trap.report(new Set(["run"]), { hidden: 3 }, { hidden: 2 });

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("hidden");
	});

	it("names the ViewModel in the warning", () => {
		const warn = warned();
		const trap = trapReading("hidden");

		trap.report(new Set(["run"]), { hidden: 3 }, { hidden: 2 });

		expect(warn.mock.calls[0][0]).toContain("VM");
	});

	it("warns once per key, however many changes follow", () => {
		const warn = warned();
		const trap = trapReading("hidden");

		trap.report(new Set(["run"]), { hidden: 3 }, { hidden: 2 });
		trap.report(new Set(["run"]), { hidden: 4 }, { hidden: 3 });

		expect(warn).toHaveBeenCalledOnce();
	});

	it("stays silent about a key the component simply does not read", () => {
		// Not reading what you do not need is what tracking exists FOR. Warning
		// here would make the trap noise instead of a signal.
		const warn = warned();
		const trap = trapReading("hidden");

		trap.report(new Set(["run"]), { unrelated: 3 }, { unrelated: 2 });

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent when the changed key is tracked directly", () => {
		const warn = warned();
		const trap = trapReading("hidden");

		trap.report(new Set(["hidden"]), { hidden: 3 }, { hidden: 2 });

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent when nothing actually changed", () => {
		const warn = warned();
		const trap = trapReading("hidden");

		trap.report(new Set(["run"]), { hidden: 2 }, { hidden: 2 });

		expect(warn).not.toHaveBeenCalled();
	});

	it("attributes a nested action's reads to the caller once it returns", () => {
		// Actions call each other. Clearing the active name instead of restoring it
		// would leave the outer action's later reads attributed to nobody, and the
		// trap would go quiet for exactly the ViewModels that compose most.
		const warn = warned();
		const trap = createLankaBlindSpotTrap("VM", true);
		const state = { inner: 1, visible: 2 } as Record<string, unknown>;
		const get = trap.observeGet(() => state);

		const actions = trap.observeActions({
			inner: () => get().inner,
			outer(): void {
				actions.inner();
				// Read AFTER the nested call returns: only a restored name attributes
				// this to `outer`.
				void get().visible;
			},
		});

		actions.outer();
		trap.report(new Set(["outer"]), { visible: 3 }, { visible: 2 });

		expect(warn).toHaveBeenCalledOnce();
	});

	it("leaves non-function members of the actions bag alone", () => {
		const trap = createLankaBlindSpotTrap("VM", true);

		const observed = trap.observeActions({ label: "not an action", run: () => 1 });

		expect(observed.label).toBe("not an action");
		expect(observed.run()).toBe(1);
	});
});
