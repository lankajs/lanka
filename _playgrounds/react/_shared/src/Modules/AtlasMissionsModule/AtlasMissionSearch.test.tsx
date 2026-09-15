import { render, cleanup, fireEvent } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasMissionSearch } from "./AtlasMissionSearch";

afterEach(cleanup);

describe("AtlasMissionSearch", () => {
	it("is findable the way a person using a screen reader finds it", () => {
		render(<AtlasMissionSearch search="" onSearch={() => undefined} />);

		expect(screen.getByLabelText("Search missions")).toBeDefined();
	});

	it("shows the term it was given rather than one of its own", () => {
		render(<AtlasMissionSearch search="depot" onSearch={() => undefined} />);

		expect(screen.getByLabelText<HTMLInputElement>("Search missions").value).toBe("depot");
	});

	it("reports the new term and holds no state", () => {
		const onSearch = vi.fn();
		render(<AtlasMissionSearch search="" onSearch={onSearch} />);

		fireEvent.change(screen.getByLabelText("Search missions"), { target: { value: "ridge" } });

		expect(onSearch).toHaveBeenCalledWith("ridge");
		// Still empty: the component is controlled, so the value on screen is the
		// caller's answer and never the keystroke. A component that echoed the
		// keystroke would drift from the ViewModel the moment an action rejected
		// one — which is what a search that trims or debounces does.
		expect(screen.getByLabelText<HTMLInputElement>("Search missions").value).toBe("");
	});

	it("renders no wrapper the caller would have to style around", () => {
		const { container } = render(<AtlasMissionSearch search="" onSearch={() => undefined} />);

		// One input and nothing else: the browser application puts this inside a
		// `<header>` beside a sort button, and a div here would be in that layout.
		expect(container.firstElementChild?.tagName).toBe("INPUT");
		expect(container.childElementCount).toBe(1);
	});
});
