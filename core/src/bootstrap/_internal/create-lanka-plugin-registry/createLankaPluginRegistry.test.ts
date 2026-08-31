import { describe, expect, it, vi } from "vitest";
import { createLankaPluginRegistry } from "./createLankaPluginRegistry";
import type { ILankaInstance } from "../../_factories/create-lanka/createLanka";

/**
 * The three decisions the registry owns.
 *
 * Each is invisible from outside and expensive when wrong: a duplicate policy
 * doubles requests, a second uninstall runs a plugin's teardown against a
 * framework that is already gone, and iterating the map while removers delete
 * from it skips every second plugin.
 */
const instance = {} as ILankaInstance;

const pluginNamed = (name: string, uninstall?: () => void) => ({
	name,
	install: vi.fn(() => uninstall),
});

describe("createLankaPluginRegistry", () => {
	it("installs a plugin with the instance", () => {
		const registry = createLankaPluginRegistry(instance);
		const plugin = pluginNamed("a");

		registry.use(plugin);

		expect(plugin.install).toHaveBeenCalledWith(instance);
	});

	it("refuses a second plugin of the same name, loudly", () => {
		const registry = createLankaPluginRegistry(instance);
		registry.use(pluginNamed("http"));

		expect(() => registry.use(pluginNamed("http"))).toThrow(/already registered/);
	});

	it("names the plugin in the refusal", () => {
		const registry = createLankaPluginRegistry(instance);
		registry.use(pluginNamed("http"));

		expect(() => registry.use(pluginNamed("http"))).toThrow(/"http"/);
	});

	it("allows the name again once the plugin is removed", () => {
		const registry = createLankaPluginRegistry(instance);
		const remove = registry.use(pluginNamed("http"));

		remove();

		expect(() => registry.use(pluginNamed("http"))).not.toThrow();
	});

	it("uninstalls once, however many times the remover is called", () => {
		const uninstall = vi.fn();
		const registry = createLankaPluginRegistry(instance);
		const remove = registry.use(pluginNamed("a", uninstall));

		remove();
		remove();
		remove();

		expect(uninstall).toHaveBeenCalledOnce();
	});

	it("does not uninstall a plugin already removed by removeAll", () => {
		const uninstall = vi.fn();
		const registry = createLankaPluginRegistry(instance);
		const remove = registry.use(pluginNamed("a", uninstall));

		registry.removeAll();
		remove();

		expect(uninstall).toHaveBeenCalledOnce();
	});

	it("removes EVERY plugin, not every second one", () => {
		// Each remover deletes its own entry. Iterating the live map would skip the
		// next plugin each time, which leaves half the framework patched.
		const uninstalls = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
		const registry = createLankaPluginRegistry(instance);
		uninstalls.forEach((uninstall, i) => registry.use(pluginNamed(`p${String(i)}`, uninstall)));

		registry.removeAll();

		for (const uninstall of uninstalls) expect(uninstall).toHaveBeenCalledOnce();
	});

	it("accepts a plugin whose install returns nothing", () => {
		const registry = createLankaPluginRegistry(instance);
		const remove = registry.use({ name: "quiet", install: () => undefined });

		expect(() => {
			remove();
			registry.removeAll();
		}).not.toThrow();
	});
});
