import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ILankaRuntime } from "./activeRuntime";

/**
 * Two COPIES of the package on one page, which is not two instances.
 *
 * Two instances from one copy is the isolation `createLanka` promises: two
 * applications in one process, each with its own bus. Two copies is a bundling
 * accident — each separately built module carried its own `lanka` — and each
 * copy then has its own pointer to its own runtime. A scenario triggered through
 * one never reaches a ViewModel registered with the other, and nothing reports
 * it: both halves of the page look correct one at a time.
 *
 * A copy is a module evaluation, so `vi.resetModules()` followed by a fresh
 * `import()` is exactly a second copy: same source, second identity.
 */

/** What every copy of the package agrees on: a name on the global object. */
const COPIES = Symbol.for("lanka.copies");

type TActiveRuntimeModule = typeof import("./activeRuntime");

/** Every copy a scene made, so none of them outlives it holding a fake runtime. */
const copies: TActiveRuntimeModule[] = [];

/** One more evaluation of the module, which is what a second bundle is. */
const copyOfLanka = async (): Promise<TActiveRuntimeModule> => {
	vi.resetModules();
	const copy = await import("./activeRuntime");
	copies.push(copy);
	return copy;
};

const runtime = (flags: { isDevelopment?: boolean }) =>
	({ getFlags: () => flags }) as unknown as ILankaRuntime;

const inDevelopment = () => runtime({ isDevelopment: true });

describe("two copies of lanka on one page", () => {
	let warn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		delete (globalThis as Record<symbol, unknown>)[COPIES];
		warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		// The shared setup resets whatever runtime the newest copy points at, and a
		// fake one has no registries to reset.
		for (const copy of copies.splice(0)) copy.setActiveLankaRuntime(null);
		warn.mockRestore();
		delete (globalThis as Record<symbol, unknown>)[COPIES];
	});

	it("warns in development when a second copy starts while the first one runs", async () => {
		const first = await copyOfLanka();
		const second = await copyOfLanka();

		first.setActiveLankaRuntime(inDevelopment());
		second.setActiveLankaRuntime(inDevelopment());

		expect(warn).toHaveBeenCalledOnce();
		expect(String(warn.mock.calls[0]?.[0])).toContain("two copies of lanka");
	});

	it("stays silent for two instances of ONE copy, which is the isolation it promises", async () => {
		const only = await copyOfLanka();

		only.setActiveLankaRuntime(inDevelopment());
		only.setActiveLankaRuntime(inDevelopment());

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent outside development", async () => {
		// A production page with two copies may be two isolated applications on
		// purpose. The warning is for the person who can still change the build.
		const first = await copyOfLanka();
		const second = await copyOfLanka();

		first.setActiveLankaRuntime(runtime({}));
		second.setActiveLankaRuntime(runtime({}));

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent once the other copy's runtime has gone", async () => {
		const first = await copyOfLanka();
		const second = await copyOfLanka();

		first.setActiveLankaRuntime(inDevelopment());
		first.setActiveLankaRuntime(null);
		second.setActiveLankaRuntime(inDevelopment());

		expect(warn).not.toHaveBeenCalled();
	});

	it("warns once per copy, not once per activation", async () => {
		// `bootstrap` activates its instance a second time, and a server activates
		// one per request. A warning per activation would bury the first one.
		const first = await copyOfLanka();
		const second = await copyOfLanka();

		first.setActiveLankaRuntime(inDevelopment());
		second.setActiveLankaRuntime(inDevelopment());
		second.setActiveLankaRuntime(inDevelopment());

		expect(warn).toHaveBeenCalledOnce();
	});

	it("warns when a copy LOADS onto a page where another copy runs in development", async () => {
		// The accident in its quietest form: a separately built module carried its
		// own lanka and never starts it, because the shell already did. Its
		// ViewModels render, and no scenario ever reaches them. Loading is the only
		// moment this copy does anything the page can see.
		const shell = await copyOfLanka();
		shell.setActiveLankaRuntime(inDevelopment());

		await copyOfLanka();

		expect(warn).toHaveBeenCalledOnce();
		expect(String(warn.mock.calls[0]?.[0])).toContain("two copies of lanka");
	});

	it("stays silent when a copy loads next to one running in production", async () => {
		const shell = await copyOfLanka();
		shell.setActiveLankaRuntime(runtime({}));

		await copyOfLanka();

		expect(warn).not.toHaveBeenCalled();
	});

	it("says so when THIS copy has no instance and another copy does", async () => {
		// The accident in its commonest form: the shell started lanka, and a module
		// that bundled its own copy reached for it. "Used before an instance
		// existed" would send the reader looking for a missing startLanka, when
		// what is missing is a line of bundler config.
		const shell = await copyOfLanka();
		const module = await copyOfLanka();

		shell.setActiveLankaRuntime(runtime({}));

		expect(() => module.requireActiveRuntime()).toThrow(/another copy of lanka/);
	});

	it("keeps the plain message when no other copy has an instance either", async () => {
		const only = await copyOfLanka();

		expect(() => only.requireActiveRuntime()).toThrow(/used before an instance existed/);
		expect(() => only.requireActiveRuntime()).not.toThrow(/another copy/);
	});

	it("names a second evaluation when THIS copy never had an instance and no other copy announces one", async () => {
		// The report this was written from: 2.1.0 ran the page, 2.2.0 was installed
		// under the open dev server, and a module loaded afterwards got a fresh
		// evaluation. A copy older than the registry never joins it, so this one
		// sees nobody — and "call createLanka" sent the reader to a call that had
		// run minutes earlier.
		const upgraded = await copyOfLanka();

		expect(() => upgraded.requireActiveRuntime()).toThrow(/used before an instance existed/);
		expect(() => upgraded.requireActiveRuntime()).toThrow(/reload the page/);
	});

	it("says the instance is gone rather than never there, once THIS copy's instance was cleared", async () => {
		const only = await copyOfLanka();

		only.setActiveLankaRuntime(runtime({}));
		only.setActiveLankaRuntime(null);

		expect(() => only.requireActiveRuntime()).toThrow(/was active in this copy/);
		expect(() => only.requireActiveRuntime()).not.toThrow(/before an instance existed/);
	});

	it("names the dev-server upgrade beside the bundling accident when another copy runs", async () => {
		// From 2.2.0 on, the same upgrade under an open page lands HERE: the old
		// copy announces itself. A reader told only about Module Federation would
		// go looking for a bundler config that is fine.
		const shell = await copyOfLanka();
		const module = await copyOfLanka();

		shell.setActiveLankaRuntime(runtime({}));

		expect(() => module.requireActiveRuntime()).toThrow(/another copy of lanka/);
		expect(() => module.requireActiveRuntime()).toThrow(/reload the page/);
	});
});
