import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";

/** The screen's needs: the ONE client the ViewModels also use, and the gateway. */
export interface IPlaygroundReactQueryScreenProps {
	client: QueryClient;
	orderGateway: PlaygroundOrderGateway;
}

const OrdersList = ({ orderGateway }: { orderGateway: PlaygroundOrderGateway }) => {
	const { data, isPending } = useQuery({
		queryKey: ["orders"],
		queryFn: () => orderGateway.list(),
		// One resource, one freshness: the same 30s the ViewModels read with. A
		// screen that considered the same data stale sooner would refetch on mount
		// and overwrite what a ViewModel had just written.
		staleTime: 30_000,
	});

	if (isPending || !data) return <p>loading</p>;

	return (
		<ul>
			{data.map((order) => (
				<li key={order.id}>{order.customer}</li>
			))}
		</ul>
	);
};

/**
 * The other way to sit a screen on TanStack Query: the component reads the
 * resource itself, with `useQuery`.
 *
 * This is the configuration for an application already built on TanStack Query
 * that adopts lanka underneath — and the one place a gateway is called outside
 * a ViewModel, which the eslint rule is CONFIGURED to allow for a query-hooks
 * folder (`allowedDirs`), not switched off. What makes it coexist with the
 * ViewModels is the client: the same instance the locator holds, handed to the
 * provider. A ViewModel's `write` is this screen's next render.
 */
export const PlaygroundReactQueryScreen = ({
	client,
	orderGateway,
}: IPlaygroundReactQueryScreenProps) => (
	<QueryClientProvider client={client}>
		<OrdersList orderGateway={orderGateway} />
	</QueryClientProvider>
);
