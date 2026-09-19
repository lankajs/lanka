import { beforeEach, describe, expect, it } from "vitest";
import { Component, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { renderWithLanka } from "./renderWithLanka";

/**
 * A render with a bootstrapped framework, checked the way a consumer uses it.
 *
 * The shape follows `@lankajs/react`'s spec for the same function: a live
 * instance reaches the component with no bootstrap written by the caller, and
 * every call gets a FRESH one. Angular's own reason for a second `beforeEach`
 * step between renders is in `_playground/playground.test.ts`'s "hands every
 * call a FRESH instance" — Angular refuses to reconfigure a module it has
 * already instantiated, so the TestBed reset below is that constraint, not
 * lanka's.
 */
@Component({ template: `<p>ready</p>`, standalone: true })
class ReadyScreen {}

beforeEach(() => {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

describe("renderWithLanka", () => {
	it("renders the component with a live instance, with no bootstrap in sight", async () => {
		const { getByText, lanka } = await renderWithLanka(ReadyScreen);

		expect(getByText("ready")).toBeTruthy();
		expect(lanka.eventBus).toBeDefined();
	});

	it("hands every call a FRESH instance", async () => {
		const first = await renderWithLanka(ReadyScreen);

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
		const second = await renderWithLanka(ReadyScreen);

		expect(second.lanka).not.toBe(first.lanka);
	});
});
