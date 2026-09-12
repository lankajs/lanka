import { describe, expect, it, vi } from "vitest";
import { createLankaScenarioBinder } from "./createLankaScenarioBinder";
import type { ILankaScenarioBindingLike } from "./createLankaScenarioBinder";

/**
 * The scenario lifetime all three ViewModel families share.
 *
 * Asserted here directly. It used to be written out in each factory, so the
 * properties below could only be checked through a ViewModel — and one of the
 * three had drifted to a different data structure.
 */
interface IContext {
	tag: string;
}

const makeScenario = (eventType: string) => {
	const release = vi.fn();
	const subscribe = vi.fn(
		(_callback: (data?: unknown) => void, _options?: Record<string, unknown>) => release,
	);
	return { eventType, subscribe, release };
};

const bindingFor = (
	scenario: ReturnType<typeof makeScenario>,
	handler = vi.fn(),
): ILankaScenarioBindingLike<IContext> => ({
	scenario,
	handler: () => handler,
});

const context = (): IContext => ({ tag: "vm" });

describe("createLankaScenarioBinder", () => {
	it("subscribes every binding on the first initialisation", () => {
		const first = makeScenario("A");
		const second = makeScenario("B");
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(first), bindingFor(second)],
			context,
		});

		binder.initializeScenario();

		expect(first.subscribe).toHaveBeenCalledOnce();
		expect(second.subscribe).toHaveBeenCalledOnce();
		expect(binder.isInitialized).toBe(true);
	});

	it("reports the ViewModel as the subscriber", () => {
		const scenario = makeScenario("A");
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(scenario)],
			context,
		});

		binder.initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledWith(expect.any(Function), { usedBy: "TestVM" });
	});

	it("does nothing on a second initialisation", () => {
		const scenario = makeScenario("A");
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(scenario)],
			context,
		});

		binder.initializeScenario();
		binder.initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledOnce();
	});

	it("subscribes one event type once, whatever the bindings say", () => {
		// Two bindings over one event type is a configuration mistake that must not
		// double the delivery: the second handler would never be released either,
		// because one key can hold one release function.
		const scenario = makeScenario("A");
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(scenario), bindingFor(scenario)],
			context,
		});

		binder.initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledOnce();
	});

	it("releases with what subscribe returned, not by callback identity", () => {
		// Two handlers whose closures compare equal must not cancel each other.
		const first = makeScenario("A");
		const second = makeScenario("B");
		const sharedHandler = vi.fn();
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(first, sharedHandler), bindingFor(second, sharedHandler)],
			context,
		});

		binder.initializeScenario();
		binder.resetScenario();

		expect(first.release).toHaveBeenCalledOnce();
		expect(second.release).toHaveBeenCalledOnce();
	});

	it("can be initialised again after a reset", () => {
		const scenario = makeScenario("A");
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(scenario)],
			context,
		});

		binder.initializeScenario();
		binder.resetScenario();
		binder.initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledTimes(2);
		expect(scenario.release).toHaveBeenCalledOnce();
	});

	it("builds handlers with the context read at bind time", () => {
		// The context is a function, not a value: a plain ViewModel builds its
		// context inside the store creator, which runs after the binder is made.
		const scenario = makeScenario("A");
		const handler = vi.fn();
		let tag = "before";

		const binder = createLankaScenarioBinder<IContext>({
			name: "TestVM",
			bindings: [{ scenario, handler: (ctx) => () => handler(ctx.tag) }],
			context: () => ({ tag }),
		});

		tag = "after";
		binder.initializeScenario();
		scenario.subscribe.mock.calls[0][0]();

		expect(handler).toHaveBeenCalledWith("after");
	});

	it("runs the lifecycle callbacks with the context", () => {
		const onInit = vi.fn();
		const onReset = vi.fn();
		const binder = createLankaScenarioBinder({ name: "TestVM", context, onInit, onReset });

		binder.initializeScenario();
		binder.resetScenario();

		expect(onInit).toHaveBeenCalledWith({ tag: "vm" });
		expect(onReset).toHaveBeenCalledWith({ tag: "vm" });
	});

	it("works for a ViewModel with no bindings at all", () => {
		const binder = createLankaScenarioBinder({ name: "TestVM", context });

		expect(() => {
			binder.initializeScenario();
			binder.resetScenario();
		}).not.toThrow();
	});

	it("reports itself uninitialised after a reset", () => {
		const binder = createLankaScenarioBinder({ name: "TestVM", context });

		binder.initializeScenario();
		expect(binder.isInitialized).toBe(true);

		binder.resetScenario();
		expect(binder.isInitialized).toBe(false);
	});

	// Whether bootstrap must be told about the ViewModel. Decided here, once: the
	// three factories each wrote the bindings half of it and none wrote the
	// lifecycle half, so a ViewModel with a hook and no scenarios was never
	// initialised.
	it("needs bootstrap when it has bindings", () => {
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(makeScenario("A"))],
			context,
		});

		expect(binder.needsBootstrap).toBe(true);
	});

	it("needs bootstrap when the bindings are a factory, without opening it", () => {
		const bindings = vi.fn(() => []);
		const binder = createLankaScenarioBinder({ name: "TestVM", bindings, context });

		expect(binder.needsBootstrap).toBe(true);
		expect(bindings).not.toHaveBeenCalled();
	});

	it("needs bootstrap when only onInit is declared", () => {
		const binder = createLankaScenarioBinder({ name: "TestVM", context, onInit: vi.fn() });

		expect(binder.needsBootstrap).toBe(true);
	});

	it("needs bootstrap when only onReset is declared", () => {
		const binder = createLankaScenarioBinder({ name: "TestVM", context, onReset: vi.fn() });

		expect(binder.needsBootstrap).toBe(true);
	});

	it("runs onInit only after every binding is subscribed", () => {
		const order: string[] = [];
		const scenario = makeScenario("A");
		scenario.subscribe.mockImplementation(() => {
			order.push("subscribe");
			return scenario.release;
		});
		const binder = createLankaScenarioBinder({
			name: "TestVM",
			bindings: [bindingFor(scenario)],
			context,
			onInit: () => order.push("init"),
		});

		binder.initializeScenario();

		expect(order).toEqual(["subscribe", "init"]);
	});

	it("does not need bootstrap with nothing to bind and nothing to be told", () => {
		expect(createLankaScenarioBinder({ name: "TestVM", context }).needsBootstrap).toBe(false);
		expect(
			createLankaScenarioBinder({ name: "TestVM", bindings: [], context }).needsBootstrap,
		).toBe(false);
	});
});
