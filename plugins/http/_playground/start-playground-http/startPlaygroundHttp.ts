import { createPlaygroundHttpPolicy } from "../create-playground-http-policy/createPlaygroundHttpPolicy";
import { startPlaygroundHttpWith } from "../start-playground-http-with/startPlaygroundHttpWith";
import type { ILankaInstance } from "lanka";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundServerScript } from "../_interfaces/IPlaygroundServerScript";
import type { TPlaygroundHttpPolicy } from "../create-playground-http-policy/createPlaygroundHttpPolicy";

/** A started application, and the gateway that knows nothing about the policy. */
export interface IPlaygroundHttp {
	lanka: ILankaInstance;
	gateway: PlaygroundOrderGateway;
}

/**
 * An application whose backend answers in ONE specific way.
 *
 * The policy is installed at start-up and never mentioned again: everything
 * below happens without any gateway knowing it does.
 */
export const startPlaygroundHttp = (
	script: IPlaygroundServerScript,
	overrides: TPlaygroundHttpPolicy = {},
): IPlaygroundHttp => startPlaygroundHttpWith(script, createPlaygroundHttpPolicy(overrides));
