import { describe, expect, it } from "vitest";
import { screen, act } from "@testing-library/react";
import { renderWithLanka } from "../src/index";
import { resetLanka } from "../src/index";
import { createLankaFakeScenario, createLankaFakeTransport } from "../src/index";
import { createPlaygroundProfileVM, PlaygroundProfileScreen } from "./app";
import type { IPlaygroundProfile } from "./app";

/**
 * The kit, used the way a consumer's test suite uses it.
 *
 * Its unit tests prove each helper behaves. This proves the promise: that a
 * consumer testing an ordinary screen writes a render call and nothing else —
 * no bootstrap preamble, no doubles of their own, and no cleanup that a later
 * test depends on them remembering.
 *
 * The isolation claims are the ones that cannot live in a unit test at all:
 * they are about what one test leaves behind for the NEXT one, so they need two.
 */
const profile = (name: string): IPlaygroundProfile => ({ name });

describe("the test kit", () => {
	it("renders a screen that needs a live framework, with no bootstrap in sight", () => {
		const useProfileVM = createPlaygroundProfileVM(
			createLankaFakeTransport({ body: profile("Ada") }),
		);

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);

		// Nothing was activated, bootstrapped or registered by this test: without
		// an instance the first locator access inside the ViewModel would throw.
		expect(screen.getByText("nobody")).toBeTruthy();
	});

	it("carries a faked answer all the way to the screen", async () => {
		const useProfileVM = createPlaygroundProfileVM(
			createLankaFakeTransport({ body: profile("Ada") }),
		);

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);
		await act(async () => {
			await useProfileVM.getState().load();
		});

		expect(screen.getByText("Ada")).toBeTruthy();
	});

	it("shows the failure the double was told to produce", async () => {
		const useProfileVM = createPlaygroundProfileVM(
			createLankaFakeTransport({ failWith: () => new Error("network is down") }),
		);

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);
		await act(async () => {
			await useProfileVM.getState().load();
		});

		expect(screen.getByRole("alert").textContent).toBe("network is down");
	});

	it("records what the application actually asked for", async () => {
		const transport = createLankaFakeTransport({ body: profile("Ada") });
		const useProfileVM = createPlaygroundProfileVM(transport);

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);
		await act(async () => {
			await useProfileVM.getState().load();
		});

		expect(transport.calls).toHaveLength(1);
		expect(transport.calls[0].endpoint).toContain("/profile");
	});

	it("hands every render a DIFFERENT instance", () => {
		const useProfileVM = createPlaygroundProfileVM(createLankaFakeTransport());

		const first = renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);
		const second = renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);

		// A test that inherits its neighbour's instance passes or fails by file
		// order, which is the worst kind of unreliable test: it goes red where
		// nothing is broken.
		expect(second.lanka).not.toBe(first.lanka);
	});

	it("disposes the previous instance rather than merely forgetting it", () => {
		let released = false;
		resetLanka().use({
			name: "playground-probe",
			install: () => () => {
				released = true;
			},
		});

		resetLanka();

		// Dropping the pointer is not disposal: ViewModels are declared at module
		// level and outlive any test, and their subscriptions are removed by the
		// dispose() of the instance whose registry holds them.
		expect(released).toBe(true);
	});

	it("gives a scenario double a REAL unsubscribe", () => {
		const scenario = createLankaFakeScenario<{ id: number }>();

		const stop = scenario.subscribe(() => undefined);
		expect(scenario.subscriberCount()).toBe(1);
		stop();

		// A stubbed unsubscribe would let a test "prove" a ViewModel unsubscribes
		// while proving only that it called a function that does nothing.
		expect(scenario.subscriberCount()).toBe(0);
	});

	it("lets a test set the instance up before the screen ever renders", () => {
		const useProfileVM = createPlaygroundProfileVM(createLankaFakeTransport());
		let sawInstance = false;

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />, {
			setup: () => {
				sawInstance = true;
			},
		});

		// Plugins and scenario registration happen BEFORE the first render, which
		// is the only order in which a screen can read what they install.
		expect(sawInstance).toBe(true);
	});
});
