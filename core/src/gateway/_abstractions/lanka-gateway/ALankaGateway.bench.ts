import { bench, describe } from "vitest";
import {
	LANKA_BENCH_OPTIONS,
	lankaBenchCalibration,
} from "@lankajs/tool-testing/lankaBenchCalibration";
import { ALankaGateway } from "./ALankaGateway";
import { buildLankaQueryParams } from "../../_utils/build-lanka-query-params/buildLankaQueryParams";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import type { ILankaRequest } from "../../_interfaces/ILankaRequest";

/**
 * What a gateway costs before the network is even reached.
 *
 * Every call to every endpoint goes through `endpoint()`, and a list screen adds
 * a query string on top. Neither does any I/O, so their cost is pure overhead —
 * invisible in a profile of a slow request and the whole profile of a fast one.
 */
describe("ALankaGateway", () => {
	lankaBenchCalibration();

	// `endpoint()` reads the host's base URL, which is a fact about the running
	// framework. Activating one here is not setup for the benchmark's sake: it is
	// the state every real call is made in.
	createLanka({
		host: {
			apiBaseUrl: "https://api.example.com",
			httpErrorMessage: (status: number) => `status ${String(status)}`,
			networkErrorMessage: () => "network",
			timeoutErrorMessage: () => "timeout",
		},
	}).activate();

	const request = { execute: () => Promise.resolve(undefined) } as unknown as ILankaRequest<
		Record<string, unknown>
	>;

	class BenchGateway extends ALankaGateway<Record<string, unknown>> {
		public constructor() {
			super({ request, basePath: "/todos" });
		}

		public resolve(path: string): string {
			return this.endpoint(path);
		}

		public query(params: Record<string, unknown>): URLSearchParams {
			return this.buildQueryParams(params);
		}
	}

	const gateway = new BenchGateway();
	const filter = { page: 2, search: "ann", tags: ["open", "mine"] };

	bench(
		"resolving a relative endpoint",
		() => {
			gateway.resolve("42");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"resolving an absolute URL, which short-circuits",
		() => {
			gateway.resolve("https://other.host/health");
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"building a query string with an array in it",
		() => {
			gateway.query(filter);
		},
		LANKA_BENCH_OPTIONS,
	);

	bench(
		"the same builder called directly",
		() => {
			buildLankaQueryParams(filter);
		},
		LANKA_BENCH_OPTIONS,
	);
});
