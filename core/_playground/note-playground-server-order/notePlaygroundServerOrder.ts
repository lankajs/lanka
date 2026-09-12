import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { TPlaygroundOrderEditContext } from "../_types/TPlaygroundOrderEditContext";

/**
 * A version of the order that arrived from elsewhere — a scenario, the cache.
 *
 * One function for both listeners, because the rule is one: the server's
 * version is replaced and MARKED, and nothing the person typed is touched. The
 * form keeps its values; the screen shows the marker; the person decides.
 *
 * The comparison is by `updatedAt`, never by reference: a cache may hand back
 * an equal object under a new identity, and this screen's OWN save comes back
 * through both listeners and must read as nothing new — which it does, because
 * the save wrote `server` before announcing anything.
 */
export const notePlaygroundServerOrder = (
	{ get, set }: TPlaygroundOrderEditContext,
	order: IPlaygroundOrder,
): void => {
	const server = get().server;
	if (!server || order.id !== server.id || order.updatedAt === server.updatedAt) return;

	set({ server: order, serverChangedAt: order.updatedAt });
};
