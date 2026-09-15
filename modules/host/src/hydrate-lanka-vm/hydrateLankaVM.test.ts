import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { hydrateLankaVM } from "./hydrateLankaVM";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaVM } from "lanka/viewmodel";

interface IScreenState {
	title: string;
	rows: readonly string[];
}

/**
 * A ViewModel shaped the way core builds one: a vanilla store, plus the two
 * members the port adds.
 *
 * Built by hand rather than through `createLankaVM` because this file is about
 * HYDRATION, and a real ViewModel would bring a scenario binder and bootstrap to
 * a test about one `setState`.
 */
const store = (initial: IScreenState): ILankaVM<IScreenState> => {
	const api = createStore<IScreenState>(() => initial);

	return Object.assign(api, { name: "HydrateSpecVM", isAccessTracked: true });
};

describe("hydrateLankaVM", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("makes server data the first state a screen reads", () => {
		const viewModel = store({ title: "", rows: [] });

		hydrateLankaVM(viewModel, { title: "From the loader", rows: ["a"] });

		expect(viewModel.getState()).toEqual({ title: "From the loader", rows: ["a"] });
	});

	it("leaves keys the snapshot does not mention alone", () => {
		const viewModel = store({ title: "declared", rows: [] });

		hydrateLankaVM(viewModel, { rows: ["a"] });

		expect(viewModel.getState().title).toBe("declared");
	});

	// React renders a component twice in StrictMode and again on every re-render.
	// A throw here would turn correct code into a crash that only reproduces in
	// development.
	it("does nothing on a second call, and does not throw", () => {
		const viewModel = store({ title: "", rows: [] });
		hydrateLankaVM(viewModel, { title: "first" });

		expect(() => {
			hydrateLankaVM(viewModel, { title: "first" });
		}).not.toThrow();
		expect(viewModel.getState().title).toBe("first");
	});

	it("NEVER overwrites what the user has since typed", () => {
		const viewModel = store({ title: "", rows: [] });
		hydrateLankaVM(viewModel, { title: "from the server" });
		viewModel.setState({ title: "what the user typed" });

		hydrateLankaVM(viewModel, { title: "from the server" });

		expect(viewModel.getState().title).toBe("what the user typed");
	});

	it("hydrates two ViewModels independently", () => {
		const one = store({ title: "", rows: [] });
		const two = store({ title: "", rows: [] });

		hydrateLankaVM(one, { title: "one" });
		hydrateLankaVM(two, { title: "two" });

		expect([one.getState().title, two.getState().title]).toEqual(["one", "two"]);
	});

	it("warns in development when a second snapshot differs", () => {
		// The mistake this catches: a navigation expecting fresh server data to land
		// in a store that already has some. Silence would leave the screen showing
		// the previous page's answer.
		const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const viewModel = store({ title: "", rows: [] });
		hydrateLankaVM(viewModel, { title: "first" });

		hydrateLankaVM(viewModel, { title: "second" });

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("title");
		lanka.dispose();
	});

	it("stays quiet when the second snapshot says the same thing", () => {
		const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const viewModel = store({ title: "", rows: [] });
		hydrateLankaVM(viewModel, { title: "same" });

		hydrateLankaVM(viewModel, { title: "same" });

		expect(warn).not.toHaveBeenCalled();
		lanka.dispose();
	});

	it("says nothing in production", () => {
		const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: false } });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const viewModel = store({ title: "", rows: [] });
		hydrateLankaVM(viewModel, { title: "first" });

		hydrateLankaVM(viewModel, { title: "second" });

		expect(warn).not.toHaveBeenCalled();
		lanka.dispose();
	});
});
