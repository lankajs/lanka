import { createLankaVM } from "../../src/viewmodel/index";
import { describePlaygroundOrdersVM } from "../describe-playground-orders-vm/describePlaygroundOrdersVM";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";

/**
 * The list, built on import. Two of these over one cache are two screens
 * reading one resource — and one request.
 */
export const createPlaygroundOrdersVM = (
	orderGateway: PlaygroundOrderGateway,
	cache: IPlaygroundReadCache,
	name = "PlaygroundOrdersVM",
) => createLankaVM(describePlaygroundOrdersVM(orderGateway, cache, name));
