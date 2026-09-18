import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import { nextTick } from "vue";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasMissionList from "./AtlasMissionList.vue";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The client half of a server-rendered page.
 *
 * The same claims `_playgrounds/react/next`'s client component makes, in Vue:
 * the server's rows arrive as an ordinary prop, hydration applies once, and the
 * screen goes on being an ordinary screen afterwards.
 *
 * No `"use client"` anywhere, and nothing standing in for it — that directive is
 * React Server Components' mechanism and Vue has none. What makes the
 * module-level ViewModel safe here is that `hydrateLankaVM` applies ONCE per
 * store, not a directive.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-15T00:00:00.000Z",
	...over,
});

const SERVER_ROWS: readonly IAtlasMission[] = [
	mission("m-1", { title: "Survey the north ridge" }),
	mission("m-2", { title: "Restock the depot" }),
];

describe("the board, starting from what the server already had", () => {
	it("paints the server's rows on the first frame", () => {
		render(AtlasMissionList, { props: { missions: SERVER_ROWS } });

		// Synchronously — no `nextTick`. That assertion IS the feature: a component
		// that fetched on mount would paint an empty list first and these rows on
		// the second frame, over a slower connection, while the user watched a
		// spinner over content the server already had.
		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
	});

	it("applies the handoff ONCE per store", async () => {
		// A later call does nothing — not a throw, because a component renders more
		// than once and a throw would turn correct code into a crash. Changing
		// hydrated state afterwards is an action's job.
		render(AtlasMissionList, { props: { missions: SERVER_ROWS } });
		cleanup();

		render(AtlasMissionList, {
			props: { missions: [mission("m-9", { title: "Never hydrated" })] },
		});
		await nextTick();

		expect(screen.queryByText("AT-109 Never hydrated")).toBeNull();
		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
	});

	it("goes on being an ordinary screen after hydration", async () => {
		render(AtlasMissionList, { props: { missions: SERVER_ROWS } });
		const input = screen.getByLabelText<HTMLInputElement>("Search missions");

		input.value = "depot";
		input.dispatchEvent(new Event("input"));
		await nextTick();

		// Hydration is the first paint; every change after it is an action.
		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeTruthy();
	});

	it("reads through the shared composable, and declares its ViewModel ONCE", () => {
		// Two claims one file can make about itself. The composable keeps this host
		// and the SPA from drifting; the plain `<script>` block is what makes the
		// ViewModel module-level — `<script setup>` IS `setup()`, so a store
		// declared there is a new one per mount, and hydration then applies to
		// every one of them.
		const source = readFileSync("app/components/AtlasMissionList.vue", "utf8");

		expect(source).toContain("@lanka-playgrounds/vue-shared");
		expect(source).toMatch(/<script lang="ts">[\s\S]*createAtlasMissionsVM/);
	});

	it("carries no client directive, because Vue has none to carry", () => {
		// React Server Components' mechanism, looked for as a DIRECTIVE rather than
		// as a word: the docblock above discusses it, and a scan that matched prose
		// would fail on its own explanation.
		const source = readFileSync("app/components/AtlasMissionList.vue", "utf8");

		expect(source.split("\n").some((line) => /^\s*["']use client["'];?\s*$/.test(line))).toBe(
			false,
		);
	});
});
