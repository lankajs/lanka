import { describe, expect, it } from "vitest";
import { createLankaStabiliser } from "./createLankaStabiliser";

interface IRow {
	id: number;
	title: string;
}

const parsedAgain = (rows: IRow[]): IRow[] => JSON.parse(JSON.stringify(rows)) as IRow[];

describe("keeping the objects a list is made of", () => {
	const rows: IRow[] = [
		{ id: 1, title: "first" },
		{ id: 2, title: "second" },
	];

	it("answers with the previous array when a refetch changed nothing", () => {
		const stabilise = createLankaStabiliser<IRow, number>({ getId: (row) => row.id });
		const first = stabilise(rows);

		// Different objects, identical data — which is what every poll returns.
		expect(stabilise(parsedAgain(rows))).toBe(first);
	});

	it("replaces only the row that changed", () => {
		const stabilise = createLankaStabiliser<IRow, number>({ getId: (row) => row.id });
		const first = stabilise(rows);

		const next = stabilise([
			{ id: 1, title: "first" },
			{ id: 2, title: "renamed" },
		]);

		expect(next).not.toBe(first);
		expect(next[0]).toBe(first[0]);
		expect(next[1]).not.toBe(first[1]);
	});

	it("keeps a row that moved, because identity is the id and not the index", () => {
		const stabilise = createLankaStabiliser<IRow, number>({ getId: (row) => row.id });
		const first = stabilise(rows);

		const reordered = stabilise(parsedAgain([rows[1], rows[0]]));

		expect(reordered[0]).toBe(first[1]);
		expect(reordered[1]).toBe(first[0]);
	});

	it("takes the application's own idea of equal", () => {
		const stabilise = createLankaStabiliser<IRow, number>({
			getId: (row) => row.id,
			// This application does not care about the title at all.
			areEqual: (previous, next) => previous.id === next.id,
		});
		const first = stabilise(rows);

		expect(
			stabilise([
				{ id: 1, title: "changed" },
				{ id: 2, title: "changed" },
			]),
		).toBe(first);
	});

	it("notices a row that left", () => {
		const stabilise = createLankaStabiliser<IRow, number>({ getId: (row) => row.id });
		stabilise(rows);

		expect(stabilise([rows[0]])).toHaveLength(1);
	});
});

describe("recognising a row that was parsed again", () => {
	interface INested {
		id: number;
		tags: string[];
		meta: { seen: Date | null };
	}

	const nested = (): INested[] => [
		{ id: 1, tags: ["a", "b"], meta: { seen: new Date("2026-01-01") } },
		{ id: 2, tags: [], meta: { seen: null } },
	];

	it("looks all the way down", () => {
		const stabilise = createLankaStabiliser<INested, number>({ getId: (row) => row.id });
		const first = stabilise(nested());

		expect(stabilise(nested())).toBe(first);
	});

	it("notices a change inside an array", () => {
		const stabilise = createLankaStabiliser<INested, number>({ getId: (row) => row.id });
		const first = stabilise(nested());
		const changed = nested();
		changed[0].tags = ["a", "c"];

		expect(stabilise(changed)).not.toBe(first);
	});

	it("notices an array that grew", () => {
		const stabilise = createLankaStabiliser<INested, number>({ getId: (row) => row.id });
		const first = stabilise(nested());
		const changed = nested();
		changed[0].tags = ["a", "b", "c"];

		expect(stabilise(changed)[0]).not.toBe(first[0]);
	});

	it("notices a field that appeared", () => {
		const stabilise = createLankaStabiliser<INested, number>({ getId: (row) => row.id });
		const first = stabilise(nested());
		const changed = nested();
		(changed[1] as unknown as Record<string, unknown>).extra = 1;

		expect(stabilise(changed)[1]).not.toBe(first[1]);
	});
});

describe("createLankaStabiliser — the shortcuts, and what they must not skip", () => {
	interface IRow {
		id: number;
		title: string;
	}

	const stabilise = () => createLankaStabiliser<IRow, number>({ getId: (row) => row.id });

	it("answers the array it was handed last time without touching a row", () => {
		const rows: IRow[] = [{ id: 1, title: "a" }];
		const keep = stabilise();

		const first = keep(rows);
		let read = 0;

		const watched = createLankaStabiliser<IRow, number>({
			getId: (row) => {
				read += 1;
				return row.id;
			},
		});

		watched(rows);
		const before = read;
		watched(rows);

		// The identity shortcut: the same array cannot have changed, so nothing is
		// read a second time.
		expect(keep(rows)).toBe(first);
		expect(read).toBe(before);
	});

	it("still notices a row that changed inside an equal-length list", () => {
		const keep = stabilise();
		const first = keep([{ id: 1, title: "a" }]);

		const second = keep([{ id: 1, title: "b" }]);

		expect(second).not.toBe(first);
		expect(second[0].title).toBe("b");
	});

	it("notices a list that changed length", () => {
		const keep = stabilise();
		const first = keep([{ id: 1, title: "a" }]);

		const second = keep([
			{ id: 1, title: "a" },
			{ id: 2, title: "b" },
		]);

		expect(second).not.toBe(first);
		expect(second[0]).toBe(first[0]);
		expect(second).toHaveLength(2);
	});
});
