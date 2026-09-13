import { AtlasChanges } from "../atlas-changes/AtlasChanges";
import type { IAtlasCrewMember } from "../_interfaces/IAtlasCrewMember";
import type { IAtlasMission, TAtlasMissionStatus } from "../_interfaces/IAtlasMission";

export interface IAtlasWorldConfig {
	/**
	 * What the clock says, in milliseconds.
	 *
	 * Injected so a test can assert that a write moved `updatedAt` without
	 * sleeping — and so two writes in the same millisecond are still two
	 * versions, which is what a client comparing them needs.
	 */
	now?: () => number;
}

/** A mission as it arrives from a client, before the server decides the rest. */
export interface IAtlasMissionDraft {
	title: string;
	priority?: number;
	crewId?: string | null;
}

const CREW: readonly IAtlasCrewMember[] = Object.freeze([
	{ id: "c-1", name: "Ada Lovelace", avatarUrl: "/api/crew/c-1/avatar.png" },
	{ id: "c-2", name: "Grace Hopper", avatarUrl: "/api/crew/c-2/avatar.png" },
	{ id: "c-3", name: "Katherine Johnson", avatarUrl: "/api/crew/c-3/avatar.png" },
]);

const SEED: readonly Omit<IAtlasMission, "updatedAt">[] = Object.freeze([
	{
		id: "m-1",
		code: "AT-101",
		title: "Survey the north ridge",
		status: "active",
		priority: 1,
		crewId: "c-1",
	},
	{
		id: "m-2",
		code: "AT-102",
		title: "Restock the depot",
		status: "queued",
		priority: 3,
		crewId: null,
	},
	{
		id: "m-3",
		code: "AT-103",
		title: "Repair the relay mast",
		status: "queued",
		priority: 2,
		crewId: "c-2",
	},
	{
		id: "m-4",
		code: "AT-104",
		title: "Map the flood plain",
		status: "done",
		priority: 4,
		crewId: "c-3",
	},
	{
		id: "m-5",
		code: "AT-105",
		title: "Calibrate the beacons",
		status: "queued",
		priority: 5,
		crewId: null,
	},
]);

/**
 * Everything the API knows, in memory, with every change announced.
 *
 * In memory because persistence is not what these applications are exercising,
 * and a database would make "start the server" a paragraph rather than a line.
 * What it does keep honest is the part the clients depend on: a version per row,
 * a change announced exactly once per write, and ids the server mints rather
 * than accepting.
 */
export class AtlasWorld {
	/** The one place a change is announced; four wires read it. */
	public readonly changes = new AtlasChanges();

	private readonly now: () => number;
	private rows = new Map<string, IAtlasMission>();
	private nextCode = SEED.length + 101;
	private nextId = SEED.length + 1;

	public constructor(config: IAtlasWorldConfig = {}) {
		this.now = config.now ?? Date.now;
		this.reset();
	}

	/** Puts the world back as it started. Every test run begins here. */
	public reset(): void {
		this.rows = new Map(
			SEED.map((seed) => [seed.id, { ...seed, updatedAt: this.stamp() }] as const),
		);
		this.nextCode = SEED.length + 101;
		this.nextId = SEED.length + 1;
	}

	public missions(): IAtlasMission[] {
		return [...this.rows.values()];
	}

	public mission(id: string): IAtlasMission | undefined {
		return this.rows.get(id);
	}

	public crew(): readonly IAtlasCrewMember[] {
		return CREW;
	}

	/** Adds a mission, minting the identity the client is not allowed to choose. */
	public add(draft: IAtlasMissionDraft): IAtlasMission {
		const mission: IAtlasMission = {
			id: `m-${String(this.nextId++)}`,
			code: `AT-${String(this.nextCode++)}`,
			title: draft.title.trim(),
			status: "queued",
			priority: draft.priority ?? 3,
			crewId: draft.crewId ?? null,
			updatedAt: this.stamp(),
		};

		this.rows.set(mission.id, mission);
		this.changes.announce("mission.added", { mission: { ...mission } });

		return mission;
	}

	/**
	 * Changes a mission, and answers what it became.
	 *
	 * `undefined` for a mission that is not there, rather than a throw: "no such
	 * row" is an answer the route turns into a 404, and an exception would make
	 * the ordinary case travel as a failure.
	 */
	public change(
		id: string,
		patch: Partial<IAtlasMissionDraft & { status: TAtlasMissionStatus }>,
	): IAtlasMission | undefined {
		const current = this.rows.get(id);
		if (!current) return undefined;

		const next: IAtlasMission = {
			...current,
			title: patch.title?.trim() ?? current.title,
			priority: patch.priority ?? current.priority,
			crewId: patch.crewId === undefined ? current.crewId : patch.crewId,
			status: patch.status ?? current.status,
			updatedAt: this.stamp(),
		};

		this.rows.set(id, next);
		this.announceChange(current, next);

		return next;
	}

	/** Removes a mission. `false` when there was nothing to remove. */
	public drop(id: string): boolean {
		const mission = this.rows.get(id);
		if (!mission) return false;

		this.rows.delete(id);
		this.changes.announce("mission.dropped", { id });

		return true;
	}

	/**
	 * The version stamp, guaranteed to move.
	 *
	 * Two writes inside one millisecond would otherwise share a stamp, and a
	 * client comparing versions to recognise its own save would see the second as
	 * the first. A counter in the low digits costs nothing and removes the case.
	 */
	private stamp(): string {
		return new Date(this.now() + this.rows.size).toISOString();
	}

	/**
	 * Says what happened, not merely that something did.
	 *
	 * A screen reacts differently to "this was completed" and "this was assigned
	 * to you", so the name carries the difference. One generic `mission.changed`
	 * would make every subscriber re-derive it from two objects.
	 */
	private announceChange(before: IAtlasMission, after: IAtlasMission): void {
		if (before.status !== after.status && after.status === "done") {
			this.changes.announce("mission.completed", { id: after.id, mission: { ...after } });
			return;
		}
		if (before.crewId !== after.crewId) {
			this.changes.announce("mission.assigned", {
				id: after.id,
				crewId: after.crewId,
				mission: { ...after },
			});
			return;
		}

		this.changes.announce("mission.edited", { id: after.id, mission: { ...after } });
	}
}
