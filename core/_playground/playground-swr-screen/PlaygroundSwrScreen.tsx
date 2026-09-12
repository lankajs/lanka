import useSWR, { SWRConfig, useSWRConfig } from "swr";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";

/** The screen's needs: the gateway to read with, and the ViewModel action to write with. */
export interface IPlaygroundSwrScreenProps {
	orderGateway: PlaygroundOrderGateway;
	/** The save, which stays a ViewModel action — SWR only reads. */
	rename: (id: number, customer: string) => Promise<void>;
}

const OrdersList = ({ orderGateway, rename }: IPlaygroundSwrScreenProps) => {
	const { data } = useSWR("orders", () => orderGateway.list());
	const { mutate } = useSWRConfig();

	if (!data) return <p>loading</p>;

	return (
		<div>
			<ul>
				{data.map((order) => (
					<li key={order.id}>{order.customer}</li>
				))}
			</ul>
			<button
				type="button"
				onClick={() => {
					// The write is the ViewModel's; what the component owns is telling
					// ITS cache to ask again. That is the whole bridge in this
					// configuration, and it runs one way.
					void rename(1, "Ann B").then(() => mutate("orders"));
				}}
			>
				rename
			</button>
		</div>
	);
};

/**
 * A screen on SWR: a hook-only cache, so it lives in the component and nowhere
 * else.
 *
 * SWR has no imperative read a ViewModel could sit on, which is why it appears
 * here only in the component configuration. The split holds all the same: the
 * component reads through its hook, the ViewModel saves through the gateway,
 * and the component revalidates its own cache afterwards. Each test gets a
 * provider of its own so one scene's cache never reaches the next.
 */
export const PlaygroundSwrScreen = (props: IPlaygroundSwrScreenProps) => (
	<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
		<OrdersList {...props} />
	</SWRConfig>
);
