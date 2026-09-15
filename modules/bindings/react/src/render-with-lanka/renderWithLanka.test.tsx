import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { createLankaVM } from "lanka/viewmodel";
import { createLankaScenario } from "lanka/scenario";
import { renderWithLanka } from "./renderWithLanka";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";

/**
 * A render with a bootstrapped framework, checked the way a consumer uses it.
 *
 * These scenes lived in `@lankajs/tool-testing` until the binding shelf
 * existed. They moved with the function: what they assert is that a React tree
 * gets a live instance, a fresh one per call, and the doubles a test registered
 * — and every one of those sentences has "React tree" in it.
 */
const testViewModel = createLankaVM<{ seen: number }, { remember: (id: number) => void }>({
	name: "RenderWithLankaSpecVM",
	states: { seen: 0 },
	createActions: ({ set }) => ({
		remember: (id) => {
			set({ seen: id });
		},
	}),
});

describe("renderWithLanka", () => {
	function Screen() {
		const { seen } = useLankaVM(testViewModel);
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

	it("brings the scenario layer up, so a screen's handlers are actually bound", () => {
		// The sentence this function's own docblock leads with. Before the scenario
		// layer was brought up here, the instance was live and the layer was not: a
		// screen whose ViewModel declares `scenarioHandlers` rendered with none of
		// them bound, and a test asserting "the fact reaches the screen" failed
		// with nothing naming the reason.
		//
		// The ViewModel is built inside `setup` because a ViewModel registers
		// itself when it is BUILT, and the fresh instance cleared whatever was
		// registered before.
		const arrived = createLankaScenario<{ text: string }>({
			name: "ToolkitArrived",
			eventType: "toolkit.arrived",
			dataTypeName: "IToolkitArrived",
		});

		let listeningVM: ReturnType<typeof buildListeningVM> | null = null;

		function Listening() {
			const { heard } = useLankaVM(listeningVM!);
			return <div data-testid="heard">{heard}</div>;
		}

		const buildListeningVM = () =>
			createLankaVM<{ heard: string }, Record<never, never>>({
				name: "ListeningVM",
				states: { heard: "" },
				createActions: () => ({}),
				scenarioHandlers: [
					{
						scenario: arrived,
						handler:
							({ set }) =>
							(data?: { text: string }) => {
								set({ heard: data?.text ?? "" });
							},
					},
				],
			});

		const { getByTestId } = renderWithLanka(<Listening />, {
			setup: () => {
				listeningVM = buildListeningVM();
			},
		});

		act(() => {
			arrived.trigger({ text: "the fact arrived" });
		});

		expect(getByTestId("heard").textContent).toBe("the fact arrived");
	});
});

describe("renderWithLanka — doubles", () => {
	function Screen() {
		const { seen } = useLankaVM(testViewModel);
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
