import { ALankaGateway } from "../../src/gateway/index";

/**
 * The least a gateway can be written as.
 *
 * No request, no transport, no options object beyond the path it serves: the
 * ordinary case is JSON over `fetch`, and a gateway that says nothing gets it.
 * `PlaygroundTodoGateway` beside it is the other end — a request built by hand,
 * because a test hands it a transport that never leaves the process.
 */
export class PlaygroundBareGateway extends ALankaGateway {
	constructor() {
		super({ basePath: "/todos" });
	}

	/** The resolved URL, so a scene can assert the host reached the gateway. */
	where(): string {
		return this.endpoint();
	}
}
