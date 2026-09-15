import { vi } from "vitest";
import type { AtlasMissionGateway, IAtlasMission } from "@lanka-playgrounds/_shared";

/** One mission, with only the fields a scene cares about spelled out. */
export const atlasMission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-15T00:00:00.000Z",
	...over,
});

export const ATLAS_ROWS: readonly IAtlasMission[] = [
	atlasMission("m-1", { title: "Survey the north ridge" }),
	atlasMission("m-2", { title: "Restock the depot" }),
];

/**
 * A gateway that answers from memory.
 *
 * The hooks under test reach the network through exactly one door — the
 * ViewModel's own gateway — so a double here is enough to drive every branch,
 * and the live suites in the applications are where a real wire is proved.
 */
export const atlasFakeGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ATLAS_ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(atlasMission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;
