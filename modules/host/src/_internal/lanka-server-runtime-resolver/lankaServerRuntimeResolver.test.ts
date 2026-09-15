import { afterEach, describe, expect, it } from "vitest";
import { lankaServerRuntimeResolver } from "./lankaServerRuntimeResolver";
import { lankaServerStorage } from "../lanka-server-storage/lankaServerStorage";
import { setActiveLankaRuntime } from "lanka/internal";
import type { ILankaRuntime } from "lanka/internal";

/**
 * Which instance answers, and the two questions that look like one.
 *
 * "No instance for THIS request" and "no request at all" used to get the same
 * reply, and the difference is the whole of what this file pins: the first must
 * fail loudly, because a fallback there is one user reading another user's
 * framework; the second is an ordinary ambient call and has an ordinary answer.
 */
const fakeRuntime = (label: string): ILankaRuntime => ({ label }) as unknown as ILankaRuntime;

afterEach(() => {
	setActiveLankaRuntime(null);
});

describe("inside a request scope", () => {
	it("answers with that scope's instance", () => {
		const scoped = fakeRuntime("request");
		setActiveLankaRuntime(fakeRuntime("process"));

		const answered = lankaServerStorage.run({ runtime: scoped }, () =>
			lankaServerRuntimeResolver(),
		);

		// The process's instance exists and is NOT the answer. Two requests in
		// flight is the case this makes safe.
		expect(answered).toBe(scoped);
	});

	it("answers null while the scope is still being set up, even with a process instance", () => {
		// The window between `run` opening and the instance being created. A
		// fallback here would hand the setup somebody else's framework, and the
		// setup is what installs plugins and runs bootstrap.
		setActiveLankaRuntime(fakeRuntime("process"));

		const answered = lankaServerStorage.run({ runtime: null }, () =>
			lankaServerRuntimeResolver(),
		);

		expect(answered).toBeNull();
	});
});

describe("outside every request scope", () => {
	it("defers to the process's own instance", () => {
		// The defect `_playgrounds/node` found: the resolver is installed once per
		// process and never removed, so before this the FIRST request made every
		// later ambient call in that process fail for the life of it.
		const ambient = fakeRuntime("process");
		setActiveLankaRuntime(ambient);

		expect(lankaServerRuntimeResolver()).toBe(ambient);
	});

	it("still answers null when the process holds no instance either", () => {
		// Every host this package was written for. Nothing about the fallback makes
		// a missing instance quieter — it makes a PRESENT one reachable.
		setActiveLankaRuntime(null);

		expect(lankaServerRuntimeResolver()).toBeNull();
	});

	it("answers the process's instance again once a scope has closed", () => {
		const ambient = fakeRuntime("process");
		setActiveLankaRuntime(ambient);

		lankaServerStorage.run({ runtime: fakeRuntime("request") }, () =>
			lankaServerRuntimeResolver(),
		);

		expect(lankaServerRuntimeResolver()).toBe(ambient);
	});
});
