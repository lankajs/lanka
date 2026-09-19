import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@solidjs/testing-library";
import { createLankaVM } from "lanka/viewmodel";
import { createLankaScenario } from "lanka/scenario";
import { renderWithLanka } from "./renderWithLanka";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";

/**
 * A render with a bootstrapped framework, checked the way a consumer uses it.
 *
 * `modules/bindings/react/src/render-with-lanka/renderWithLanka.test.tsx` is the
 * precedent this mirrors — same claims, same order — because everything but
 * WHICH `render` is called is `prepareLankaRender` in `@lankajs/tool-testing`,
 * shared by every binding on the shelf. What differs here is only Solid's own
 * mechanics: a component is a function passed to `render`, not a JSX element,
 * and there is no `act` because Solid's scheduler settles synchronously.
 */

afterEach(() => {
	cleanup();
});

const testViewModel = createLankaVM<{ seen: number }, { remember: (id: number) => void }>({
	name: "SolidRenderWithLankaSpecVM",
	states: { seen: 0 },
	createActions: ({ set }) => ({
		remember: (id) => {
			set({ seen: id });
		},
	}),
});

describe("renderWithLanka", () => {
	const Screen = () => {
		const state = useLankaVM(testViewModel);
		return <div data-testid="seen">{state().seen}</div>;
	};

	it("renders a component with a bootstrapped framework", () => {
		const { getByTestId } = renderWithLanka(() => <Screen />);

		expect(getByTestId("seen").textContent).toBe("0");
	});

	it("returns the instance it rendered with", () => {
		const { lanka } = renderWithLanka(() => <Screen />);

		expect(lanka.eventBus).toBeDefined();
	});

	it("allows configuring the instance BEFORE rendering", () => {
		// Plugins and scenarios are installed before the first render: installed
		// after it, they would miss what the component already read.
		const setup = vi.fn();

		renderWithLanka(() => <Screen />, { setup });

		expect(setup).toHaveBeenCalledTimes(1);
	});

	it("every render gets a fresh instance", () => {
		const first = renderWithLanka(() => <Screen />);
		const second = renderWithLanka(() => <Screen />);

		expect(first.lanka).not.toBe(second.lanka);
	});

	it("brings the scenario layer up, so a screen's handlers are actually bound", () => {
		// The sentence this function's own docblock leads with. Before the scenario
		// layer was brought up here, the instance was live and the layer was not: a
		// screen whose ViewModel declares `scenarioHandlers` rendered with none of
		// them bound.
		//
		// The ViewModel is built inside `setup` because a ViewModel registers
		// itself when it is BUILT, and the fresh instance cleared whatever was
		// registered before.
		const arrived = createLankaScenario<{ text: string }>({
			name: "SolidToolkitArrived",
			eventType: "solid.toolkit.arrived",
			dataTypeName: "IToolkitArrived",
		});

		let listeningVM: ReturnType<typeof buildListeningVM> | null = null;

		const Listening = () => {
			const state = useLankaVM(listeningVM!);
			return <div data-testid="heard">{state().heard}</div>;
		};

		const buildListeningVM = () =>
			createLankaVM<{ heard: string }, Record<never, never>>({
				name: "SolidListeningVM",
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

		const { getByTestId } = renderWithLanka(() => <Listening />, {
			setup: () => {
				listeningVM = buildListeningVM();
			},
		});

		// No `act`: Solid's scheduler runs a signal's observers before the trigger
		// call returns, so there is nothing here to flush.
		arrived.trigger({ text: "the fact arrived" });

		expect(getByTestId("heard").textContent).toBe("the fact arrived");
	});
});

describe("renderWithLanka — doubles", () => {
	const Screen = () => {
		const state = useLankaVM(testViewModel);
		return <div data-testid="seen">{state().seen}</div>;
	};

	it("registers the fakes before the first render", () => {
		const profileGateway = { load: () => Promise.resolve({ name: "Ada" }) };

		const { lanka } = renderWithLanka(() => <Screen />, {
			fakes: { gateways: { PlaygroundProfileGateway: profileGateway } },
		});

		expect(lanka.locators.gateways.get("playgroundProfileGateway")).toBe(profileGateway);
	});

	it("runs `setup` AFTER the fakes, so a test may use both", () => {
		const order: string[] = [];
		const marker = {};

		renderWithLanka(() => <Screen />, {
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
