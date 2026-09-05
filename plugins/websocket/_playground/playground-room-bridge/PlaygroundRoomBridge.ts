import { ALankaStreamBridge } from "../../src/index";
import { playgroundMessageArrived } from "../playground-message-arrived/PlaygroundMessageArrived";

/**
 * What a consumer writes: one bridge per family of server events.
 *
 * It does the translation and stops there — no state, no screen, no decision
 * about what the message means, and no sending. A bridge that starts deciding is
 * a ViewModel that cannot be tested without a socket; one that also sends is the
 * object every screen ends up reaching into.
 */
export class PlaygroundRoomBridge extends ALankaStreamBridge {
	public register(): void {
		this.on("room.message", (payload) => {
			playgroundMessageArrived.trigger(payload as { text: string });
		});
	}
}
