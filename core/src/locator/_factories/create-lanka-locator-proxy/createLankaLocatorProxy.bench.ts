import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { createLankaLocatorProxy } from "./createLankaLocatorProxy";
import type { ILankaLocator } from "../../_interfaces/ILankaLocator";

/**
 * What every ambient facade costs per access.
 *
 * `lankaGateways.todoGateway` is written on every call to every gateway, so its
 * price is paid once per request and once per action. The interesting number is
 * not the proxy's own overhead but what it adds ON TOP of the locator's cached
 * lookup, which is why both are here.
 */
describe("createLankaLocatorProxy", () => {
	lankaBenchCalibration();

	const instance = { id: "one" };

	// A locator that has already resolved and cached: what an application's
	// second access onwards actually hits, so the number is the proxy's own cost
	// rather than a construction nobody repeats.
	const locator: ILankaLocator<typeof instance> = { get: () => instance };

	const proxy = createLankaLocatorProxy<typeof instance, Record<string, typeof instance>>({
		locator,
	});

	bench(
		"resolving a name through the proxy",
		() => {
			void proxy.someGateway;
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same resolution without the proxy",
		() => {
			void locator.get("someGateway");
		},
		LANKA_BENCH_OPTIONS,
	);
});
