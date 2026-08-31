import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaCollectionView } from "./createLankaCollectionView";
import type { ILankaSortState } from "../../_interfaces/ILankaSortState";

/**
 * What a table costs per render.
 *
 * Sorting, filtering and stabilising run on every keystroke in a search box and
 * on every column click, over the whole list rather than the visible page. A
 * thousand rows is where a screen stops feeling instant, so that is the size.
 *
 * Every one of them memoises on the arguments it was given, which is the point
 * of the pairs below: the hit is what a re-render pays and the miss is what the
 * click pays, and the two differ by three orders of magnitude. A bench that
 * measured only the hit would report that sorting a thousand rows is free.
 */
interface IRow {
	id: number;
	title: string;
	done: boolean;
	updatedAt: Date;
}

describe("createLankaCollectionView", () => {
	lankaBenchCalibration();

	const rows: IRow[] = Array.from({ length: 1000 }, (_, index) => ({
		id: index,
		title: `row ${String((index * 7919) % 1000)}`,
		done: index % 3 === 0,
		updatedAt: new Date(1_700_000_000_000 + index * 1000),
	}));

	const view = createLankaCollectionView<IRow, number>({
		getValue: (row, field) => row[field as keyof IRow],
		getId: (row) => row.id,
	});

	const ascending: ILankaSortState = { field: "title", order: "asc" };
	const descending: ILankaSortState = { field: "title", order: "desc" };
	const sorted = view.sort(rows, ascending);

	let flip = false;

	bench(
		"sorting 1000 rows, the memo missed",
		() => {
			flip = !flip;
			view.sort(rows, flip ? ascending : descending);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"sorting with the arguments of the previous call",
		() => {
			view.sort(rows, ascending);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"filtering 1000 rows by a substring, the memo missed",
		() => {
			view.filter(rows, [{ field: "title", operator: "contains", value: "7" }]);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"filtering 1000 rows by three rules, which is what a real table has",
		() => {
			view.filter(rows, [
				{ field: "title", operator: "contains", value: "7" },
				{ field: "done", operator: "eq", value: false },
				{ field: "updatedAt", operator: "gte", value: new Date(1_700_000_100_000) },
			]);
		},
		LANKA_BENCH_OPTIONS,
	);
	bench(
		"paginating with the arguments of the previous call",
		() => {
			view.paginate(sorted, 3, 25);
		},
		LANKA_BENCH_OPTIONS,
	);

	// Stabilising is the one operation with memory of its own, so each of its two
	// cases gets a view of its own: sharing one would leave the second bench
	// measuring whatever the first left behind, and the order of the file would
	// decide the number.
	const forRerender = createLankaCollectionView<IRow, number>({
		getValue: (row, field) => row[field as keyof IRow],
		getId: (row) => row.id,
	});

	const forPoll = createLankaCollectionView<IRow, number>({
		getValue: (row, field) => row[field as keyof IRow],
		getId: (row) => row.id,
	});

	// What a poll hands back: fresh objects, identical data, a fresh array every
	// time. Eight of them, cycled, so the bench allocates nothing per iteration
	// and still never hands over the array it handed over last.
	const polls = Array.from({ length: 8 }, () =>
		sorted.map((row) => ({ ...row, updatedAt: new Date(row.updatedAt) })),
	);

	forRerender.stabilise(sorted);
	let poll = 0;

	bench(
		"stabilising a refetch, which is what a poll hands back",
		() => {
			poll = (poll + 1) % polls.length;
			forPoll.stabilise(polls[poll]);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"stabilising an unchanged list, which is what a re-render does",
		() => {
			forRerender.stabilise(sorted);
		},
		LANKA_BENCH_OPTIONS,
	);
});
