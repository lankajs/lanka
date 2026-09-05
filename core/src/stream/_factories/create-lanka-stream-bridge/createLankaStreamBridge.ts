import { ALankaStreamBridge } from "../../_abstractions/lanka-stream-bridge/ALankaStreamBridge";
import type { ILankaStreamBridgeContext } from "../../_interfaces/ILankaStreamBridgeContext";
import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";
import type { ILankaStreamTriggerContext } from "../create-lanka-stream-trigger-context/createLankaStreamTriggerContext";

/**
 * A bridge, without writing a class.
 *
 * What a bridge does is one function — subscribe these events, trigger those
 * scenarios — and the class exists to carry the subscriptions and the "from
 * outside" marker, which this carries identically: it IS an `ALankaStreamBridge`.
 *
 * The plugin receives what a class-style bridge would give it, `dispose`
 * included, so nothing above knows which style wrote it.
 *
 * Two steps rather than one call: a bridge needs the transport and the marker,
 * and both belong to the plugin INSTALLATION rather than to the module that
 * declares the bridge. So the declaration is written once at module level and
 * the plugin applies it, which is what lets the same bridge be handed to two
 * instances in one process.
 */
export const createLankaStreamBridge =
	(register: (context: ILankaStreamBridgeContext) => void) =>
	(
		stream: ILankaServerEventTransport,
		trigger: ILankaStreamTriggerContext,
	): ALankaStreamBridge => {
		class FunctionalBridge extends ALankaStreamBridge {
			public register(): void {
				register({
					on: (eventType, handler) => {
						this.on(eventType, handler);
					},
					onSignal: (eventType, handler) => {
						this.onSignal(eventType, handler);
					},
					onReconnect: (handler) => {
						this.onReconnect(handler);
					},
				});
			}
		}

		return new FunctionalBridge(stream, trigger);
	};
