import { createLanka } from "lanka";
import { lankaHttp } from "../../src/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import { createPlaygroundTransport } from "../_testing/create-playground-transport/createPlaygroundTransport";
import type { IPlaygroundHttp } from "../start-playground-http/startPlaygroundHttp";
import type { IPlaygroundServerScript } from "../_interfaces/IPlaygroundServerScript";
import type { TPlaygroundHttpPolicy } from "../create-playground-http-policy/createPlaygroundHttpPolicy";

/**
 * The same application under a policy given WHOLE.
 *
 * Needed because a policy is not only what it adds: a preset for a token session
 * is defined partly by carrying no CSRF header, and a harness that merges every
 * policy over its own defaults can never show an absence.
 */
export const startPlaygroundHttpWith = (
	script: IPlaygroundServerScript,
	policy: TPlaygroundHttpPolicy,
): IPlaygroundHttp => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	lanka.use(lankaHttp(policy));

	return { lanka, gateway: new PlaygroundOrderGateway(createPlaygroundTransport(script)) };
};
