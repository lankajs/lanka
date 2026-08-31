import { describe, expect, it, vi } from "vitest";
import { createLanka } from "./createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaPlugin } from "../../ILankaPlugin";

/**
 * The fifth extension point. It arrived with the first plugin deliberately: a
 * point declared earlier would describe an imagined need while costing real
 * support.
 */

const plugin = (name: string, install: ILankaPlugin["install"]): ILankaPlugin => ({
	name,
	install,
});

describe("lanka.use", () => {
	it("installs a plugin, handing it THIS instance", () => {
		const lanka = createLanka({ host: lankaTestHost });
		const install = vi.fn();

		lanka.use(plugin("p", install));

		// A private route to the framework would be shared by every instance: a test
		// beside the app would share its configuration.
		expect(install).toHaveBeenCalledWith(lanka);
	});

	it("removes what it installed when the plugin is removed", () => {
		const lanka = createLanka({ host: lankaTestHost });
		const uninstall = vi.fn();

		const remove = lanka.use(plugin("p", () => uninstall));
		remove();

		expect(uninstall).toHaveBeenCalledTimes(1);
	});

	it("removing twice does nothing", () => {
		// Removing twice is an ordinary caller mistake; the second call must not
		// touch what someone else installed in the meantime.
		const lanka = createLanka({ host: lankaTestHost });
		const uninstall = vi.fn();

		const remove = lanka.use(plugin("p", () => uninstall));
		remove();
		remove();

		expect(uninstall).toHaveBeenCalledTimes(1);
	});

	it("rejects a second plugin with the same name", () => {
		const lanka = createLanka({ host: lankaTestHost });
		lanka.use(plugin("policy", () => undefined));

		expect(() => lanka.use(plugin("policy", () => undefined))).toThrow(/already registered/i);
	});

	it("after removal the name is free again", () => {
		// Otherwise reconfiguring a plugin would require a new framework instance.
		const lanka = createLanka({ host: lankaTestHost });
		const remove = lanka.use(plugin("policy", () => undefined));
		remove();

		expect(() => lanka.use(plugin("policy", () => undefined))).not.toThrow();
	});

	it("disposing the instance removes every plugin", () => {
		const lanka = createLanka({ host: lankaTestHost });
		const first = vi.fn();
		const second = vi.fn();
		lanka.use(plugin("a", () => first));
		lanka.use(plugin("b", () => second));

		lanka.dispose();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("a plugin without an uninstall does not block disposal", () => {
		// An `install` returning `void` is legal: not every plugin installs something
		// removable.
		const lanka = createLanka({ host: lankaTestHost });
		lanka.use(plugin("a", () => undefined));

		expect(() => lanka.dispose()).not.toThrow();
	});
});
