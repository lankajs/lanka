import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";

/** The data layer every order ViewModel is handed. */
export interface IPlaygroundOrderGateways {
	orderGateway: PlaygroundOrderGateway;
}
