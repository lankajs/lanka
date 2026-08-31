import { ALankaSseBridge } from "../../src/index";
import { playgroundMessageArrived } from "../playground-message-arrived/PlaygroundMessageArrived";

/**
 * What a consumer writes: one bridge per family of server events.
 *
 * It does the translation and stops there — no state, no screen, no decision
 * about what the message means. A bridge that starts deciding is a ViewModel
 * that cannot be tested without a socket.
 */
export class PlaygroundChatBridge extends ALankaSseBridge {
	public register(): void {
		this.on("message", (payload) => {
			playgroundMessageArrived.trigger(payload as { text: string });
		});
	}
}
