/**
 * A render with a bootstrapped framework, checked the way a consumer uses it.
 *
 * The same claims `@lankajs/react`'s `renderWithLanka.test.tsx` pins — a fresh
 * instance per call, the doubles a test registered landing before the first
 * render — asked here in Svelte's own vocabulary. Svelte Testing Library's
 * `render` needs an actual `.svelte` file, so the screen these scenes mount is
 * `RenderWithLankaSpecScreen.svelte`, beside this test.
 */
import { describe, expect, it, vi } from "vitest";
import { createLankaVM } from "lanka/viewmodel";
import { renderWithLanka } from "./renderWithLanka";
import RenderWithLankaSpecScreen from "./RenderWithLankaSpecScreen.svelte";

const buildViewModel = () =>
	createLankaVM<{ seen: number }, { remember: (id: number) => void }>({
		name: "RenderWithLankaSvelteSpecVM",
		states: { seen: 0 },
		createActions: ({ set }) => ({
			remember: (id) => {
				set({ seen: id });
			},
		}),
	});

describe("renderWithLanka", () => {
	it("renders a component with a bootstrapped framework", () => {
		const { getByTestId } = renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
		});

		// Svelte Testing Library's bound queries type as a union over every
		// overload `render` has; every one of them is an `HTMLElement` here.
		expect((getByTestId("seen") as HTMLElement).textContent).toBe("0");
	});

	it("returns the instance it rendered with", () => {
		const { lanka } = renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
		});

		expect(lanka.eventBus).toBeDefined();
	});

	it("allows configuring the instance BEFORE rendering", () => {
		// Plugins and scenarios are installed before the first render: installed
		// after it, they would miss what the component already read.
		const setup = vi.fn();

		renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
			setup,
		});

		expect(setup).toHaveBeenCalledTimes(1);
	});

	it("hands every call a FRESH instance", () => {
		const first = renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
		});
		const second = renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
		});

		expect(first.lanka).not.toBe(second.lanka);
	});
});

describe("renderWithLanka — doubles", () => {
	it("registers the fakes before the first render", () => {
		const profileGateway = { load: () => Promise.resolve({ name: "Ada" }) };

		const { lanka } = renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
			fakes: { gateways: { PlaygroundProfileGateway: profileGateway } },
		});

		expect(lanka.locators.gateways.get("playgroundProfileGateway")).toBe(profileGateway);
	});

	it("runs `setup` AFTER the fakes, so a test may use both", () => {
		const order: string[] = [];
		const marker = {};

		renderWithLanka(RenderWithLankaSpecScreen, {
			props: { viewModel: buildViewModel() },
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
