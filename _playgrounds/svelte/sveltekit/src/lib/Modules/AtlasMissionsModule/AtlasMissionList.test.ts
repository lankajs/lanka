import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasMissionList from "./AtlasMissionList.svelte";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The client half of a server-rendered page.
 *
 * The same claims `_playgrounds/react/next` and `_playgrounds/vue/nuxt` make,
 * in Kit: the server's rows arrive as ordinary data, hydration applies once, and
 * the screen goes on being an ordinary screen afterwards.
 *
 * One claim is this host's own and it is the opposite of Nuxt's — the ViewModel
 * is per INSTANCE here, because Kit's rule is that module-level state on a
 * server is shared by every user connected to it.
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

		// Synchronously — no flush. That assertion IS the feature: a component that
		// fetched on mount would paint an empty list first and these rows on the
		// second frame, over a slower connection, while the user watched a spinner
		// over content the server already had.
		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
	});

	it("gives every RENDER its own ViewModel, which is Kit's rule and not a taste", () => {
		// The scene this host exists for. On a server, module-level state is shared
		// by every user connected to the process — Kit's documentation says so
		// outright — so a ViewModel declared beside this component would be one
		// store for the whole deployment, and two overlapping requests would serve
		// each other's rows.
		//
		// `_playgrounds/vue/nuxt` asserts the OPPOSITE of this, and both are right:
		// Vue's `<script setup>` IS `setup()`, so a module-level store was the only
		// way there to make hydration apply once. The two files read as a
		// contradiction until you know each framework's own rule, which is why they
		// both say it at length.
		render(AtlasMissionList, { props: { missions: SERVER_ROWS } });
		render(AtlasMissionList, {
			props: { missions: [mission("m-9", { title: "A second reader entirely" })] },
		});

		expect(screen.getByText("AT-101 Survey the north ridge")).toBeTruthy();
		expect(screen.getByText("AT-109 A second reader entirely")).toBeTruthy();
	});

	it("goes on being an ordinary screen after hydration", async () => {
		render(AtlasMissionList, { props: { missions: SERVER_ROWS } });

		await fireEvent.input(screen.getByLabelText("Search missions"), {
			target: { value: "depot" },
		});
		flushSync();

		// Hydration is the first paint; every change after it is an action.
		expect(screen.queryByText("AT-101 Survey the north ridge")).toBeNull();
		expect(screen.getByText("AT-102 Restock the depot")).toBeTruthy();
	});

	it("reads through the shared read path rather than a copy of its own", () => {
		// What keeps this host and the SPA from drifting. A component that called
		// `useLankaVM` directly would be a second answer to a question the ecosystem
		// has already answered once.
		const source = readFileSync(
			"src/lib/Modules/AtlasMissionsModule/AtlasMissionList.svelte",
			"utf8",
		);

		expect(source).toContain("@lanka-playgrounds/svelte-shared");
	});

	it("carries no client directive, because Kit has none to carry", () => {
		// React Server Components' mechanism, looked for as a DIRECTIVE rather than
		// as a word: the docblock above discusses it, and a scan that matched prose
		// would fail on its own explanation.
		const source = readFileSync(
			"src/lib/Modules/AtlasMissionsModule/AtlasMissionList.svelte",
			"utf8",
		);

		expect(source.split("\n").some((line) => /^\s*["']use client["'];?\s*$/.test(line))).toBe(
			false,
		);
	});
});
