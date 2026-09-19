import { createLankaBurstCoalescer, createLankaLatestGuard } from "@lankajs/async";
import { createLankaOptimisticActions } from "@lankajs/optimistic";
import { describe, expect, it, vi } from "vitest";
import { startAtlas } from "./startAtlas";
import { createAtlasMissionView } from "./ViewModels/AtlasMissionsViewModel/_Services/createAtlasMissionView";
import { replaceAtlasMission } from "./ViewModels/AtlasMissionsViewModel/_Services/replaceAtlasMission";
import type { IAtlasMission } from "./Core/Interfaces/IAtlasMission";

/**
 * The edges this application stands on, asked the awkward question.
 *
 * Every case here is one an Atlas screen can actually reach — a duplicate id
 * from a server that paginated badly, a page number left behind by a filter, two
 * presses of one button, a background read that fails while a foreground one is
 * in flight. Each is written against the module through the SAME seam the
 * application uses, because a module tested through its own unit spec is tested
 * by somebody who already knows what it does.
 */
const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-${id}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
	...over,
});

describe("the list view, at its edges", () => {
	it("does not merge two rows a server sent under one id", () => {
		// A paginating server that repeats a row across pages is a real and common
		// failure. `stabilise` recognises rows BY id, so a duplicate is the one
		// input that can make it hand back the wrong object for a row.
		const view = createAtlasMissionView();
		const rows = [mission("m-1", { title: "First" }), mission("m-1", { title: "Second" })];

		const stable = view.stabilise(rows);

		expect(stable).toHaveLength(2);
		expect(stable[0].title).toBe("First");
		expect(stable[1].title).toBe("Second");
	});

	it("answers an empty page rather than nothing when the page is past the end", () => {
		// A filter that shrinks the result leaves the reader on page four of a
		// two-page list. The screen has to render SOMETHING, and `items` being
		// undefined is the difference between an empty state and a crash.
		const view = createAtlasMissionView();
		const rows = [mission("m-1"), mission("m-2")];

		const page = view.paginate(rows, 9, 3);

		expect(page.items).toEqual([]);
		expect(page.totalPages).toBe(1);
	});

	it("keeps row identity across a refetch that changed nothing", () => {
		const view = createAtlasMissionView();
		const first = view.stabilise([mission("m-1"), mission("m-2")]);

		const second = view.stabilise([mission("m-1"), mission("m-2")]);

		// Identity, not equality: a new object for an unchanged row is a new prop
		// for every memoised row below it.
		expect(second[0]).toBe(first[0]);
		expect(second[1]).toBe(first[1]);
	});

	it("sorts rows whose column is null without dropping them", () => {
		// `crewId` is nullable by design — an unassigned mission. Sorting by it is
		// a thing the board offers, so null has to have a place in the order rather
		// than falling out of the list.
		const view = createAtlasMissionView();
		const rows = [
			mission("m-1", { crewId: "c-2" }),
			mission("m-2", { crewId: null }),
			mission("m-3", { crewId: "c-1" }),
		];

		const sorted = view.sort(rows, { field: "crewId", order: "asc" });

		expect(sorted).toHaveLength(3);
		expect(sorted.map((one) => one.id).sort()).toEqual(["m-1", "m-2", "m-3"]);
	});
});

describe("replacing a row", () => {
	it("leaves the list alone when the row is not in it", () => {
		// A scenario carries a mission this screen has never listed — a different
		// board, or one filtered out. Appending it would put a row on screen that
		// the reader's own filter excluded.
		const rows = [mission("m-1")];

		const after = replaceAtlasMission(rows, mission("m-9", { title: "Somebody else's" }));

		expect(after.map((one) => one.id)).toEqual(["m-1"]);
	});
});

describe("two presses of one button", () => {
	it("reports a blocked second delete instead of running it twice", async () => {
		const optimistic = createLankaOptimisticActions();
		const server = vi.fn(
			() =>
				new Promise<{ id: string }>((resolve) =>
					setTimeout(() => resolve({ id: "m-1" }), 20),
				),
		);
		const rollback = vi.fn();

		const [first, second] = await Promise.all([
			optimistic.runExclusive("mission:m-1:remove", () => [], server, rollback),
			optimistic.runExclusive("mission:m-1:remove", () => [], server, rollback),
		]);

		// Three outcomes, not a boolean: "blocked, already in flight" and "ran and
		// failed" must be handled in opposite ways, and only one of them is silent.
		expect([first, second].filter((one) => one === "executed")).toHaveLength(1);
		expect([first, second]).toContain("blocked");
		expect(server).toHaveBeenCalledTimes(1);
		// Nothing failed, so nothing may be rolled back — a blocked call never
		// touched the state and undoing it would undo the call that DID run.
		expect(rollback).not.toHaveBeenCalled();
	});

	it("does not roll back a completion that was merely superseded", async () => {
		const optimistic = createLankaOptimisticActions();
		const rollback = vi.fn();
		const settle = vi.fn(
			(_signal?: AbortSignal) =>
				new Promise<string>((resolve) => setTimeout(() => resolve("done"), 10)),
		);

		const first = optimistic.runLatest(
			"mission:m-1:complete",
			() => "before",
			(signal) => settle(signal),
			rollback,
			() => undefined,
		);
		const second = optimistic.runLatest(
			"mission:m-1:complete",
			() => "before",
			(signal) => settle(signal),
			rollback,
			() => undefined,
		);

		await Promise.all([first, second]);

		// A superseded press is not a failed press. Rolling it back would undo the
		// optimistic write that the press replacing it just made.
		expect(rollback).not.toHaveBeenCalled();
	});
});

describe("a burst of reads", () => {
	it("does not let a failed coalesced read poison the next one", async () => {
		// The coalescer hands one promise to a whole burst. If a rejection were
		// remembered with the key, every later refresh of that list would fail
		// without ever calling the server.
		const coalescer = createLankaBurstCoalescer<string>();
		const read = vi.fn().mockRejectedValueOnce(new Error("gone")).mockResolvedValue(undefined);

		await expect(coalescer.run("missions", read)).rejects.toThrow("gone");
		await expect(coalescer.run("missions", read)).resolves.toBeUndefined();
	});

	it("lets the latest guard reject a stale answer that arrives last", async () => {
		// Nothing orders two responses. The screen must end up showing the read it
		// started LAST, not the one that happened to return last.
		const guard = createLankaLatestGuard();

		const stale = guard.start();
		const fresh = guard.start();

		expect(guard.isCurrent(fresh)).toBe(true);
		expect(guard.isCurrent(stale)).toBe(false);
	});
});

describe("what a started application remembers between visits", () => {
	it("holds preferences, so no host has to build them", async () => {
		// It used to exist and be called by nothing but its own unit test, which is
		// the shape of a package proved on paper: `@lankajs/storage`'s encrypted twin
		// hashes the KEY as well as the value, and a claim like that is worth
		// something only once an application stores through it.
		const app = await startAtlas({ apiBaseUrl: "http://127.0.0.1:1/api" });

		expect(typeof app.preferences.read).toBe("function");

		app.lanka.dispose();
	});

	it("reads its defaults before anything has been written", async () => {
		const app = await startAtlas({ apiBaseUrl: "http://127.0.0.1:1/api" });

		// Defaults beat a crash on start-up for a preference nobody would miss —
		// and a store that threw here would take the whole application with it.
		expect(await app.preferences.read()).toEqual({ sortField: null, isPanelOpen: false });

		app.lanka.dispose();
	});
});
