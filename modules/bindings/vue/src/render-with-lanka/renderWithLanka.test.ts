import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { createLankaVM } from "lanka/viewmodel";
import { createLankaScenario } from "lanka/scenario";
import { renderWithLanka } from "./renderWithLanka";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";

/**
 * A render with a bootstrapped framework, checked the way a consumer uses it.
 *
 * The same promises `@lankajs/react`'s `renderWithLanka.test.tsx` pins — a live
 * instance, a fresh one per call, the caller's doubles, the scenario layer
 * brought up before the render — asserted here through Vue's own `render`. What
 * `IPrepareLankaRenderOptions` itself promises lives once in
 * `@lankajs/tool-testing`; this file is only "does the Vue adapter deliver it".
 */
const testViewModel = createLankaVM<{ seen: number }, { remember: (id: number) => void }>({
	name: "VueRenderWithLankaSpecVM",
	states: { seen: 0 },
	createActions: ({ set }) => ({
		remember: (id) => {
			set({ seen: id });
		},
	}),
});

describe("renderWithLanka", () => {
	const Screen = defineComponent({
		setup() {
			const state = useLankaVM(testViewModel);
			return () => h("div", { "data-testid": "seen" }, String(state.value.seen));
		},
	});

	it("renders a component with a bootstrapped framework", () => {
		const { getByTestId } = renderWithLanka(Screen);

		expect(getByTestId("seen").textContent).toBe("0");
	});

	it("returns the instance it rendered with", () => {
		const { lanka } = renderWithLanka(Screen);

		expect(lanka.eventBus).toBeDefined();
	});

	it("allows configuring the instance BEFORE rendering", () => {
		// Plugins and scenarios are installed before the first render: installed
		// after it, they would miss what the component already read.
		const setup = vi.fn();

		renderWithLanka(Screen, { setup });

		expect(setup).toHaveBeenCalledTimes(1);
	});

	it("every render gets a fresh instance", () => {
		const first = renderWithLanka(Screen);
		const second = renderWithLanka(Screen);

		expect(first.lanka).not.toBe(second.lanka);
	});

	it("brings the scenario layer up, so a screen's handlers are actually bound", async () => {
		// Before the scenario layer was brought up inside `prepareLankaRender`, the
		// instance was live and the layer was not: a screen whose ViewModel declares
		// `scenarioHandlers` rendered with none of them bound.
		//
		// The ViewModel is built inside `setup` because a ViewModel registers itself
		// when it is BUILT, and the fresh instance cleared whatever was registered
		// before.
		const arrived = createLankaScenario<{ text: string }>({
			name: "VueToolkitArrived",
			eventType: "vue-toolkit.arrived",
			dataTypeName: "IVueToolkitArrived",
		});

		let listeningVM: ReturnType<typeof buildListeningVM> | null = null;

		const buildListeningVM = () =>
			createLankaVM<{ heard: string }, Record<never, never>>({
				name: "VueListeningVM",
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

		const Listening = defineComponent({
			setup() {
				const state = useLankaVM(listeningVM!);
				return () => h("div", { "data-testid": "heard" }, state.value.heard);
			},
		});

		const { getByTestId } = renderWithLanka(Listening, {
			setup: () => {
				listeningVM = buildListeningVM();
			},
		});

		arrived.trigger({ text: "the fact arrived" });
		await nextTick();

		expect(getByTestId("heard").textContent).toBe("the fact arrived");
	});
});

describe("renderWithLanka — doubles", () => {
	const Screen = defineComponent({
		setup() {
			const state = useLankaVM(testViewModel);
			return () => h("div", { "data-testid": "seen" }, String(state.value.seen));
		},
	});

	it("registers the fakes before the first render", () => {
		const profileGateway = { load: () => Promise.resolve({ name: "Ada" }) };

		const { lanka } = renderWithLanka(Screen, {
			fakes: { gateways: { PlaygroundProfileGateway: profileGateway } },
		});

		expect(lanka.locators.gateways.get("playgroundProfileGateway")).toBe(profileGateway);
	});

	it("runs `setup` AFTER the fakes, so a test may use both", () => {
		const order: string[] = [];

		renderWithLanka(Screen, {
			fakes: { singletons: { First: {} } },
			setup: (lanka) => {
				order.push(
					lanka.locators.singletons.isRegistered("First") ? "fakes first" : "setup first",
				);
			},
		});

		expect(order).toEqual(["fakes first"]);
	});
});
