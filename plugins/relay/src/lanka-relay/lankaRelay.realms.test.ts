// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { build } from "esbuild";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LANKA_DI_FIXTURE } from "@lankajs/tool-testing/vitest";
import { createLankaRelayBroadcastChannelTransport } from "../_factories/create-lanka-relay-broadcast-channel-transport/createLankaRelayBroadcastChannelTransport";
import { lankaRelay } from "./lankaRelay";
import type { ILankaInstance } from "lanka/bootstrap";
import type {
	TLankaRelayRealmCommand,
	TLankaRelayRealmReport,
} from "../_testing/start-lanka-relay-realm/startLankaRelayRealm";
import type { ILankaRelayOptions } from "./lankaRelay";

/**
 * Two REALMS: this test's, and a worker thread's — each with its own global
 * object, so each with its own page registry, and nothing shared but the
 * `BroadcastChannel` both open.
 *
 * Node's `BroadcastChannel` is the browser's, delivering asynchronously between
 * threads the way a browser delivers between tabs and workers, so a worker thread
 * is a real second realm rather than a stand-in for one. The worker runs the
 * package's own source, bundled for it here: `_testing/start-lanka-relay-realm`
 * is one application that installs the relay as a consumer would and reports
 * what it hears.
 */

const RELAY_KEY = Symbol.for("lanka.relay");

const HARNESS = join(process.cwd(), "src/_testing/start-lanka-relay-realm/startLankaRelayRealm.ts");

let directory = "";
let bundle = "";

const workers: Worker[] = [];
const instances: ILankaInstance[] = [];

beforeAll(async () => {
	directory = mkdtempSync(join(tmpdir(), "lanka-relay-realm-"));
	bundle = join(directory, "realm.mjs");

	await build({
		stdin: {
			contents: [
				'import { parentPort } from "node:worker_threads";',
				`import { startLankaRelayRealm } from ${JSON.stringify(HARNESS)};`,
				"startLankaRelayRealm(parentPort);",
			].join("\n"),
			resolveDir: process.cwd(),
			loader: "ts",
		},
		bundle: true,
		platform: "node",
		format: "esm",
		outfile: bundle,
		alias: { "@lanka_di": LANKA_DI_FIXTURE },
		logLevel: "silent",
	});
}, 60_000);

afterEach(async () => {
	for (const lanka of instances.splice(0)) lanka.dispose();
	await Promise.all(workers.splice(0).map((worker) => worker.terminate()));
	delete (globalThis as Record<symbol, unknown>)[RELAY_KEY];
});

afterAll(() => {
	rmSync(directory, { recursive: true, force: true });
});

/** An application in THIS realm, on the medium. */
const here = (options: Omit<ILankaRelayOptions, "transport">) => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(lankaRelay({ ...options, transport: createLankaRelayBroadcastChannelTransport() }));
	instances.push(lanka);
	return lanka;
};

/** An application in a worker thread, started and on the medium when this resolves. */
const inAWorker = async (
	options: Omit<ILankaRelayOptions, "transport">,
	listen: readonly string[] = [],
) => {
	const worker = new Worker(bundle);
	workers.push(worker);
	const reports: TLankaRelayRealmReport[] = [];
	worker.on("message", (report: TLankaRelayRealmReport) => reports.push(report));

	const send = (command: TLankaRelayRealmCommand) => {
		worker.postMessage(command);
	};

	send({ do: "start", options, listen });
	await vi.waitFor(() => {
		expect(reports).toContainEqual({ started: true });
	});

	return {
		heard: (eventType: string) =>
			reports.flatMap((report) =>
				"heard" in report && report.heard === eventType ? [report.data] : [],
			),
		dispatch: (eventType: string, data: unknown) => {
			send({ do: "dispatch", eventType, data });
		},
	};
};

const heardOn = (lanka: ILankaInstance, eventType: string) => {
	const heard = vi.fn();
	lanka.eventBus.subscribe(eventType, heard, { replay: "last" });
	return heard;
};

describe("a relay across two realms", () => {
	it("carries an event to an application in a worker thread, and one back", async () => {
		const page = here({ channel: "shop", send: ["CART_CHANGED"], receive: ["CHECKOUT"] });
		const heardOnPage = heardOn(page, "CHECKOUT");
		const worker = await inAWorker(
			{ channel: "shop", send: ["CHECKOUT"], receive: ["CART_CHANGED"] },
			["CART_CHANGED"],
		);

		page.eventBus.dispatch("CART_CHANGED", { count: 3 });
		worker.dispatch("CHECKOUT", { total: 12 });

		await vi.waitFor(() => {
			expect(worker.heard("CART_CHANGED")).toEqual([{ count: 3 }]);
			expect(heardOnPage).toHaveBeenCalledWith({ total: 12 });
		});
	});

	it("hands a worker that starts late the newest value the page retained — once, and before what follows", async () => {
		// One sender's frames keep their order, so the answer to the worker's hello
		// arrives before the event the page dispatches after it. Were the retained
		// value delivered twice, or a stale one with it, the list would say so.
		const page = here({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] });
		page.eventBus.dispatch("CART_CHANGED", { count: 1 });
		page.eventBus.dispatch("CART_CHANGED", { count: 2 });

		const worker = await inAWorker({ channel: "shop", receive: ["CART_CHANGED"] }, [
			"CART_CHANGED",
		]);
		await vi.waitFor(() => {
			expect(worker.heard("CART_CHANGED")).toHaveLength(1);
		});
		page.eventBus.dispatch("CART_CHANGED", { count: 3 });

		await vi.waitFor(() => {
			expect(worker.heard("CART_CHANGED")).toHaveLength(2);
		});
		expect(worker.heard("CART_CHANGED")).toEqual([{ count: 2 }, { count: 3 }]);
	});

	it("hands an application that joins the page late what a worker retained", async () => {
		// The worker's command queue and the medium are two queues, so "the worker
		// has retained it" is established by an application here hearing it live —
		// and that one retains nothing, so the late one's value can only come from
		// the worker's answer.
		const early = here({ channel: "shop", receive: ["CHECKOUT"] });
		const heardEarly = heardOn(early, "CHECKOUT");
		const worker = await inAWorker({
			channel: "shop",
			send: ["CHECKOUT"],
			retain: ["CHECKOUT"],
		});
		worker.dispatch("CHECKOUT", { total: 12 });
		await vi.waitFor(() => {
			expect(heardEarly).toHaveBeenCalledOnce();
		});

		const late = here({ channel: "shop", receive: ["CHECKOUT"] });
		const heardLate = heardOn(late, "CHECKOUT");

		await vi.waitFor(() => {
			expect(heardLate).toHaveBeenCalledWith({ total: 12 });
		});
	});
});
