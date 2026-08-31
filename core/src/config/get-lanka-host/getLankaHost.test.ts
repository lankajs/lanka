import { describe, expect, it } from "vitest";
import { createLanka } from "../../bootstrap/_factories/create-lanka/createLanka";
import { getLankaHost } from "./getLankaHost";
import type { ILankaHost } from "../_interfaces/ILankaHost";

/**
 * Everything the framework cannot know is asked for in one place, at compile
 * time.
 *
 * `apiBaseUrl` is part of the contract because otherwise each consumer knows the
 * URL and the framework does not, making `@lankajs/plugin-sse` impossible.
 * `networkErrorMessage` and `timeoutErrorMessage` are separate because
 * `LankaError` separates `network` from `timeout`, and how an application phrases
 * each is not the framework's to know.
 *
 * Every field is REQUIRED: a forgotten one is a compile error at the host itself
 * rather than a wrong-language string in the interface or an `undefined` inside a
 * request URL.
 */

const host: ILankaHost = {
	apiBaseUrl: "https://api.example.test",
	httpErrorMessage: (status) => `status ${status}`,
	networkErrorMessage: () => "no connection",
	timeoutErrorMessage: () => "no response in time",
};

describe("the host contract", () => {
	it("supplies everything the framework cannot guess", () => {
		createLanka({ host });

		const resolved = getLankaHost();

		expect(resolved.apiBaseUrl).toBe("https://api.example.test");
		expect(resolved.httpErrorMessage(404)).toBe("status 404");
		expect(resolved.networkErrorMessage()).toBe("no connection");
		expect(resolved.timeoutErrorMessage()).toBe("no response in time");
	});

	it("without an instance it fails loudly instead of defaulting", () => {
		// No default, deliberately: a substituted message factory would print a
		// wrong-language string and look like copy nobody got round to. Silently
		// wrong is worse than loudly absent.
		createLanka({ host }).dispose();

		expect(() => getLankaHost()).toThrowError(/instance/i);
	});

	it("one instance's host is invisible to another", () => {
		const first = createLanka({ host });
		const second = createLanka({
			host: { ...host, apiBaseUrl: "https://second.example.test" },
		});

		expect(first.config.host?.apiBaseUrl).toBe("https://api.example.test");
		expect(second.config.host?.apiBaseUrl).toBe("https://second.example.test");
	});
});
