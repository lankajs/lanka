import { ALankaSseBridge } from "../../_abstractions/lanka-sse-bridge/ALankaSseBridge";
import type { ILankaSseBridgeContext } from "../../_interfaces/ILankaSseBridgeContext";
import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";
import type { ILankaSseTriggerContext } from "../create-lanka-sse-trigger-context/createLankaSseTriggerContext";

/**
 * A bridge, without writing a class.
 *
 * What a bridge does is one function — subscribe these events, trigger those
 * scenarios — and the class exists to carry the subscriptions and the "from
 * outside" marker, which this carries identically: it IS an `ALankaSseBridge`.
 *
 * The plugin receives what a class-style bridge would give it, `dispose`
 * included, so nothing above knows which style wrote it.
 */
export const createLankaSseBridge =
	(register: (context: ILankaSseBridgeContext) => void) =>
	(sse: ILankaServerEventTransport, trigger: ILankaSseTriggerContext): ALankaSseBridge => {
		class FunctionalBridge extends ALankaSseBridge {
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

		return new FunctionalBridge(sse, trigger);
	};
