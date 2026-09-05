import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "./createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * Two frameworks in one process share nothing.
 *
 * With module-level state — the bus registry, the scenario registries, four
 * locator caches, the in-flight counter, the config — three things are
 * impossible, and none of them surfaces as an error; they surface as oddities:
 *
 * - **two applications in one process** (micro-frontends, Storybook beside the
 *   app) silently share a bus: one's event reaches the other's subscribers;
 * - **SSR** reuses state between different users' requests;
 * - **test isolation** rests on a global `beforeEach` reaching into internal
 *   registries — on discipline rather than on construction.
 *
 * What must be checked is NON-sharing rather than the presence of a method: a
 * `createLanka()` returning a facade over the same global statics passes every
 * check except this one.
 */

const host = lankaTestHost;

describe("createLanka — instance isolation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("an event dispatched on one bus never reaches another bus's subscriber", () => {
		const first = createLanka({ host });
		const second = createLanka({ host });

		const heardByFirst = vi.fn();
		const heardBySecond = vi.fn();

		first.eventBus.subscribe("SHARED_EVENT", heardByFirst);
		second.eventBus.subscribe("SHARED_EVENT", heardBySecond);

		first.eventBus.dispatch("SHARED_EVENT", { id: 1 });

		expect(heardByFirst).toHaveBeenCalledTimes(1);
		expect(heardBySecond).not.toHaveBeenCalled();
	});

	it("instances have separate scenario registries", () => {
		const first = createLanka({ host });
		const second = createLanka({ host });

		expect(first.scenarios).not.toBe(second.scenarios);
		expect(first.viewModels).not.toBe(second.viewModels);
	});

	it("each instance has its own in-flight counter", () => {
		const first = createLanka({ host });
		const second = createLanka({ host });

		first.inFlight.begin();

		expect(first.inFlight.getActiveCount()).toBe(1);
		expect(second.inFlight.getActiveCount()).toBe(0);
	});

	it("one instance's config is invisible to another", () => {
		const first = createLanka({ host, flags: { isMockMode: true } });
		const second = createLanka({ host, flags: { isMockMode: false } });

		expect(first.getFlags().isMockMode).toBe(true);
		expect(second.getFlags().isMockMode).toBe(false);
	});

	it("a second instance bootstraps instead of exiting on someone else's flag", async () => {
		const first = createLanka({ host });
		const second = createLanka({ host });

		const firstService = vi.fn();
		const secondService = vi.fn();

		await first.bootstrap({ services: [{ name: "First", init: firstService }] });
		await second.bootstrap({ services: [{ name: "Second", init: secondService }] });

		expect(firstService).toHaveBeenCalledTimes(1);
		expect(secondService).toHaveBeenCalledTimes(1);
	});

	it("bootstrapping ONE instance twice is idempotent", async () => {
		const lanka = createLanka({ host });
		const service = vi.fn();

		await lanka.bootstrap({ services: [{ name: "Once", init: service }] });
		await lanka.bootstrap({ services: [{ name: "Once", init: service }] });

		expect(service).toHaveBeenCalledTimes(1);
	});
});

describe("createLanka — bootstrapping while a bootstrap is in flight", () => {
	// Two routes starting the app, or StrictMode mounting twice: both callers
	// arrive before the first plan has finished, both read "not bootstrapped",
	// and every service used to run twice. The flag flips at the END of the
	// plan, so idempotence has to hold while the plan is still running.
	it("joins the run in flight instead of starting a second one", async () => {
		const lanka = createLanka({ host });
		let open = (): void => undefined;
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		const service = vi.fn(() => gate);

		const first = lanka.bootstrap({ services: [{ name: "Slow", init: service }] });
		const second = lanka.bootstrap({ services: [{ name: "Slow", init: service }] });
		open();
		await Promise.all([first, second]);

		expect(service).toHaveBeenCalledTimes(1);
		expect(lanka.isBootstrapped()).toBe(true);
	});
});
