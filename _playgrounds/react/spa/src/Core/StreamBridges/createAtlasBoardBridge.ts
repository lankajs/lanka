import { atlasBoardMessagePosted, atlasStreamReconnected } from "@lanka-playgrounds/_shared";
import { createLankaStreamBridge } from "@lankajs/plugin-websocket";

/**
 * What arrives over the board's socket, and which fact each message is.
 *
 * Inbound only, on a two-way wire as much as on a one-way one. A bridge that
 * also SENT would be the one object that both starts and finishes a
 * conversation: untestable without a socket, and the place every screen
 * eventually reaches into. Sending belongs to whoever already owns the action —
 * here, `AtlasBoardChannel`.
 */
export const createAtlasBoardBridge = () =>
	createLankaStreamBridge(({ on, onReconnect }) => {
		on("board.said", (payload) => {
			const said = payload as { text?: unknown; at?: unknown };
			if (typeof said.text !== "string") return;

			atlasBoardMessagePosted.trigger({
				text: said.text,
				at: typeof said.at === "string" ? said.at : new Date().toISOString(),
			});
		});

		onReconnect(() => {
			atlasStreamReconnected.trigger({ wire: "board" });
		});
	});
