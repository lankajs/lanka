import { describe, expect, it, vi } from "vitest";
import { createLankaVM } from "lanka/viewmodel";
import { LankaFetchJsonRequest } from "lanka/gateway";
import { createLankaFakeScenario, createLankaFakeTransport } from "./lankaTestFakes";
import { renderWithLanka } from "./renderWithLanka";
import { resetLanka } from "./resetLanka";

/**
 * The kit verifies itself — and what matters most is what these tests do NOT
 * do.
 *
 * None of them reaches into the framework's internals. That is what the kit
 * exists for: without it, tests reach into the scenario registry directly and
 * any registry refactor breaks all of them at once.
 */

const scenario = createLankaFakeScenario<{ id: number }>("gap.updated");

const useTestViewModel = createLankaVM<{ seen: number }, { remember: (id: number) => void }>({
	name: "TestVM",
	states: { seen: 0 },
	createActions: ({ set }) => ({
		remember: (id: number) => {
			set({ seen: id });
		},
	}),
	scenarioHandlers: [
		{
			scenario,
			handler:
				({ set }) =>
				(data: { id: number } | undefined) => {
					set({ seen: data?.id ?? 0 });
				},
		},
	],
});

describe("resetLanka", () => {
	it("the first test leaves a subscription behind", () => {
		resetLanka();
		useTestViewModel.getState().initializeScenario();

		expect(scenario.subscriberCount()).toBeGreaterThan(0);
	});

	it("the second does not see it — proven WITHOUT touching internals", () => {
		// Exactly what the kit exists for. A test that inherits foreign
		// subscriptions passes or fails depending on its neighbour, and goes red
		// where nothing is broken.
		expect(scenario.subscriberCount()).toBe(0);
	});

	it("returns a live instance rather than only cleaning", () => {
		const lanka = resetLanka();

		expect(lanka.isBootstrapped()).toBe(false);
		expect(lanka.eventBus).toBeDefined();
	});

	it("every call yields a NEW instance", () => {
		// Cleaning leaves behind whatever nobody remembered to clean. A fresh object
		// cannot carry someone else's state by oversight.
		expect(resetLanka()).not.toBe(resetLanka());
	});
});

describe("renderWithLanka", () => {
	function Screen() {
		const { seen } = useTestViewModel();
		return <div data-testid="seen">{seen}</div>;
	}

	it("renders a component with a bootstrapped framework", () => {
		const { getByTestId } = renderWithLanka(<Screen />);

		expect(getByTestId("seen").textContent).toBe("0");
	});

	it("returns the instance it rendered with", () => {
		const { lanka } = renderWithLanka(<Screen />);

		expect(lanka.eventBus).toBeDefined();
	});

	it("allows configuring the instance BEFORE rendering", () => {
		// Plugins and scenarios are installed before the first render: installed
		// after it, they would miss what the component already read.
		const setup = vi.fn();

		renderWithLanka(<Screen />, { setup });

		expect(setup).toHaveBeenCalledTimes(1);
	});

	it("every render gets a fresh instance", () => {
		const first = renderWithLanka(<Screen />);
		const second = renderWithLanka(<Screen />);

		expect(first.lanka).not.toBe(second.lanka);
	});
});

describe("test doubles", () => {
	it("the transport records calls", async () => {
		const transport = createLankaFakeTransport({ body: { ok: true } });
		resetLanka();

		await new LankaFetchJsonRequest({ transport }).execute("/api/things", { method: "POST" });

		expect(transport.calls).toHaveLength(1);
		expect(transport.calls[0]?.endpoint).toBe("/api/things");
	});

	it("the transport can fail", async () => {
		const transport = createLankaFakeTransport({
			failWith: () => new TypeError("Failed to fetch"),
		});
		resetLanka();

		await expect(
			new LankaFetchJsonRequest({ transport }).execute("/api/things"),
		).rejects.toMatchObject({ kind: "network" });
	});

	it("the scenario double returns a REAL unsubscribe", () => {
		// A stub instead would make the test "the ViewModel unsubscribes" prove only
		// that a function doing nothing was called.
		const fake = createLankaFakeScenario<{ id: number }>();
		const handler = vi.fn();

		const off = fake.subscribe(handler);
		expect(fake.subscriberCount()).toBe(1);

		off();
		fake.emit({ id: 1 });

		expect(fake.subscriberCount()).toBe(0);
		expect(handler).not.toHaveBeenCalled();
	});

	it("the scenario double fires at every subscriber", () => {
		const fake = createLankaFakeScenario<{ id: number }>();
		const first = vi.fn();
		const second = vi.fn();
		fake.subscribe(first);
		fake.subscribe(second);

		fake.emit({ id: 7 });

		expect(first).toHaveBeenCalledWith({ id: 7 });
		expect(second).toHaveBeenCalledWith({ id: 7 });
	});

	it("the scenario double remembers what it carried", () => {
		// Without this a test asserting WHAT a ViewModel published wraps `emit` by
		// hand and then asserts on its own wrapper.
		const fake = createLankaFakeScenario<{ id: number }>();

		fake.emit({ id: 1 });
		fake.trigger({ id: 2 });

		expect(fake.emitted).toEqual([{ id: 1 }, { id: 2 }]);
	});
});

describe("the transport answers per endpoint", () => {
	const send = (transport: ReturnType<typeof createLankaFakeTransport>, endpoint: string) =>
		new LankaFetchJsonRequest({ transport }).execute<{ from: string }>(endpoint);

	it("gives each route its own answer", async () => {
		// A screen reads more than one endpoint. One answer for all of them is why
		// consumers write the twenty-line double this kit exists to prevent.
		const transport = createLankaFakeTransport({
			routes: [
				{ match: "/profile", body: { from: "profile" } },
				{ match: /\/orders$/, body: { from: "orders" } },
			],
			body: { from: "fallback" },
		});
		resetLanka();

		expect(await send(transport, "/api/profile")).toEqual({ from: "profile" });
		expect(await send(transport, "/api/orders")).toEqual({ from: "orders" });
		expect(await send(transport, "/api/anything")).toEqual({ from: "fallback" });
	});

	it("lets a route answer a limited number of times", async () => {
		// "Failed once, then succeeded" — the shape a retry policy is tested with,
		// and one a single-answer double cannot express at all.
		const transport = createLankaFakeTransport({
			routes: [
				{ match: "/profile", times: 1, failWith: () => new TypeError("Failed to fetch") },
			],
			body: { from: "second attempt" },
		});
		resetLanka();

		await expect(send(transport, "/api/profile")).rejects.toMatchObject({ kind: "network" });
		expect(await send(transport, "/api/profile")).toEqual({ from: "second attempt" });
	});

	it("matches with a predicate when the endpoint alone cannot say", async () => {
		const transport = createLankaFakeTransport({
			routes: [{ match: (_endpoint, options) => options?.method === "POST", status: 201 }],
		});
		resetLanka();

		await new LankaFetchJsonRequest({ transport }).execute("/api/things", { method: "POST" });

		expect(transport.callsTo("/api/things")).toHaveLength(1);
		expect(transport.callsTo("/api/other")).toHaveLength(0);
	});

	it("answers late when a route asks it to", async () => {
		// What a loading state is asserted with: without a delay the request is
		// already finished by the time the assertion runs.
		const transport = createLankaFakeTransport({
			routes: [{ match: "/profile", delayMs: 5, body: { from: "slow" } }],
		});
		resetLanka();

		const answered = send(transport, "/api/profile");
		expect(transport.calls).toHaveLength(1);

		expect(await answered).toEqual({ from: "slow" });
	});
});

describe("renderWithLanka — doubles", () => {
	function Screen() {
		const { seen } = useTestViewModel();
		return <div data-testid="seen">{seen}</div>;
	}

	it("registers the fakes before the first render", () => {
		const profileGateway = { load: () => Promise.resolve({ name: "Ada" }) };

		const { lanka } = renderWithLanka(<Screen />, {
			fakes: { gateways: { PlaygroundProfileGateway: profileGateway } },
		});

		expect(lanka.locators.gateways.get("playgroundProfileGateway")).toBe(profileGateway);
	});

	it("runs `setup` AFTER the fakes, so a test may use both", () => {
		const order: string[] = [];
		const marker = {};

		renderWithLanka(<Screen />, {
			fakes: { singletons: { First: marker } },
			setup: (lanka) => {
				order.push(
					lanka.locators.singletons.isRegistered("First") ? "fakes first" : "setup first",
				);
			},
		});

		expect(order).toEqual(["fakes first"]);
	});
});
