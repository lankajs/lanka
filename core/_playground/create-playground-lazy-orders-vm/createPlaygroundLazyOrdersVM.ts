import { createLazyLankaVM } from "../../src/viewmodel/index";
import { describePlaygroundOrdersVM } from "../describe-playground-orders-vm/describePlaygroundOrdersVM";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";

/**
 * The same list, built on first use and released with `dispose()`.
 *
 * The release is what matters with a cache underneath: `onReset` stops the
 * subscription and cancels a load in flight, so a screen nobody is looking at
 * neither repaints nor keeps a request alive.
 */
export const createPlaygroundLazyOrdersVM = (
	orderGateway: PlaygroundOrderGateway,
	cache: IPlaygroundReadCache,
) => createLazyLankaVM(describePlaygroundOrdersVM(orderGateway, cache, "PlaygroundLazyOrdersVM"));
