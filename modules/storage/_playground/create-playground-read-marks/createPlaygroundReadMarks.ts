import { LankaIdRegistry } from "../../src/index";

/**
 * Ids kept as numbers, because a set of long string ids is what fills a quota.
 *
 * The registry is the package's answer to "a thousand ids in localStorage":
 * every id becomes a number, and the number decodes back to exactly the id.
 */
export const createPlaygroundReadMarks = () => {
	const registry = new LankaIdRegistry();
	const marks = new Set<number>();

	return {
		async markRead(id: string): Promise<void> {
			marks.add(await registry.encode(id));
		},

		async isRead(id: string): Promise<boolean> {
			return marks.has(await registry.encode(id));
		},

		get size(): number {
			return marks.size;
		},

		all(): string[] {
			return [...marks]
				.map((id) => registry.decode(id))
				.filter((id): id is string => id !== null);
		},
	};
};
