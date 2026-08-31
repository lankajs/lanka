import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { hydrateLankaVM } from "./hydrateLankaVM";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

interface IScreenState {
	title: string;
	rows: readonly string[];
}

const store = (initial: IScreenState) => create<IScreenState>(() => initial);

describe("hydrateLankaVM", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("makes server data the first state a screen reads", () => {
		const useVM = store({ title: "", rows: [] });

		hydrateLankaVM(useVM, { title: "From the loader", rows: ["a"] });

		expect(useVM.getState()).toEqual({ title: "From the loader", rows: ["a"] });
	});

	it("leaves keys the snapshot does not mention alone", () => {
		const useVM = store({ title: "declared", rows: [] });

		hydrateLankaVM(useVM, { rows: ["a"] });

		expect(useVM.getState().title).toBe("declared");
	});

	// React renders a component twice in StrictMode and again on every re-render.
	// A throw here would turn correct code into a crash that only reproduces in
	// development.
	it("does nothing on a second call, and does not throw", () => {
		const useVM = store({ title: "", rows: [] });
		hydrateLankaVM(useVM, { title: "first" });

		expect(() => {
			hydrateLankaVM(useVM, { title: "first" });
		}).not.toThrow();
		expect(useVM.getState().title).toBe("first");
	});

	it("NEVER overwrites what the user has since typed", () => {
		const useVM = store({ title: "", rows: [] });
		hydrateLankaVM(useVM, { title: "from the server" });
		useVM.setState({ title: "what the user typed" });

		hydrateLankaVM(useVM, { title: "from the server" });

		expect(useVM.getState().title).toBe("what the user typed");
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
		const useVM = store({ title: "", rows: [] });
		hydrateLankaVM(useVM, { title: "first" });

		hydrateLankaVM(useVM, { title: "second" });

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("title");
		lanka.dispose();
	});

	it("stays quiet when the second snapshot says the same thing", () => {
		const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const useVM = store({ title: "", rows: [] });
		hydrateLankaVM(useVM, { title: "same" });

		hydrateLankaVM(useVM, { title: "same" });

		expect(warn).not.toHaveBeenCalled();
		lanka.dispose();
	});

	it("says nothing in production", () => {
		const lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: false } });
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const useVM = store({ title: "", rows: [] });
		hydrateLankaVM(useVM, { title: "first" });

		hydrateLankaVM(useVM, { title: "second" });

		expect(warn).not.toHaveBeenCalled();
		lanka.dispose();
	});
});
