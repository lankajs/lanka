import { describe, expect, it } from "vitest";
import { lankaBoundaries } from "../src/index";
import {
	lintWithPinnedStyles,
	lintWithPublishedConfig,
	playgroundFiles,
	publishedRuleNames,
} from "./app";

/**
 * The package, used as a consumer's ESLint uses it.
 *
 * A rule's own tests run it through RuleTester, which never touches the plugin
 * object or the published config. Everything asserted here needs all three to
 * agree: a rule registered under one name and switched on under another passes
 * every unit test and lints nobody.
 */
describe("the eslint playground", () => {
	it("publishes exactly the rules the config switches on", () => {
		// The failure this prevents: a rule renamed in one place, left behind in
		// the other, and silently disabled for every consumer.
		const registered = publishedRuleNames();
		const enabled = Object.keys(lankaBoundaries.rules ?? {}).map((name) =>
			name.replace(/^lanka\//, ""),
		);

		expect(enabled.sort()).toEqual(registered.sort());
	});

	it("registers the plugin under the namespace the rules use", () => {
		expect(Object.keys(lankaBoundaries.plugins ?? {})).toEqual(["lanka"]);
	});

	it("passes a module importing a module", () => {
		expect(lintWithPublishedConfig(playgroundFiles.moduleToModule)).toEqual([]);
	});

	it("reports the core reaching up into a module", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.coreToModule);

		expect(messages).toHaveLength(1);
		expect(messages[0].ruleId).toBe("lanka/no-upward-imports");
	});

	it("passes a gateway used inside a ViewModel", () => {
		expect(lintWithPublishedConfig(playgroundFiles.gatewayInViewModel)).toEqual([]);
	});

	it("reports a gateway reached from a component", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.gatewayInComponent);

		expect(messages.map((message) => message.ruleId)).toContain(
			"lanka/gateways-only-in-viewmodels",
		);
	});

	it("reports the application reading its own DI barrels", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.diBarrelInApp);

		expect(messages.map((message) => message.ruleId)).toContain(
			"lanka/di-barrels-are-framework-only",
		);
	});

	it("reports as an ERROR, not a warning", () => {
		// A boundary reported as a warning is a boundary nothing enforces: warnings
		// accumulate and merges proceed.
		const messages = lintWithPublishedConfig(playgroundFiles.coreToModule);

		expect(messages[0].severity).toBe(2);
	});

	it("explains what to do, not merely what is wrong", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.coreToModule);

		expect(messages[0].message.length).toBeGreaterThan(40);
	});
});

describe("the two rules that keep a layer from reaching sideways", () => {
	it("catches a gateway calling another gateway", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.gatewayToGateway);

		// TWO rules fire, and both are right: a gateway calling a gateway is also a
		// gateway reached from outside a ViewModel. The chain belongs one layer up,
		// where its loading state, its failure and its cancellation have an owner.
		expect(messages.map((message) => message.ruleId)).toContain("lanka/no-gateway-to-gateway");
		expect(messages).toHaveLength(2);
	});

	it("catches a ViewModel importing a ViewModel", () => {
		const messages = lintWithPublishedConfig(playgroundFiles.viewModelToViewModel);

		expect(messages).toHaveLength(1);
		expect(messages[0].ruleId).toBe("lanka/no-viewmodel-to-viewmodel");
	});

	it("leaves a screen reading a ViewModel alone", () => {
		// Rung 1 of the ladder is what ViewModels are FOR; only sideways is wrong.
		expect(lintWithPublishedConfig(playgroundFiles.gatewayInViewModel)).toHaveLength(0);
	});
});

describe("the style a project pins per layer", () => {
	/** What both applications this framework grew out of actually chose. */
	const asTheAncestorsWrote = { gateway: "class", viewmodel: "functional" };

	it("says nothing until a project chooses", () => {
		// Switched on by the published config, and silent: shipping a new rule must
		// not fail a project that never made this decision.
		expect(lintWithPublishedConfig(playgroundFiles.gatewayByCalling)).toEqual([]);
		expect(lintWithPublishedConfig(playgroundFiles.viewModelAsClass)).toEqual([]);
	});

	it("leaves both layers alone when they are written the pinned way", () => {
		expect(lintWithPinnedStyles(playgroundFiles.gatewayAsClass, asTheAncestorsWrote)).toEqual(
			[],
		);
		expect(
			lintWithPinnedStyles(playgroundFiles.viewModelByCalling, asTheAncestorsWrote),
		).toEqual([]);
	});

	it("reports the form the project excluded, in each direction", () => {
		const gateway = lintWithPinnedStyles(playgroundFiles.gatewayByCalling, asTheAncestorsWrote);
		const viewModel = lintWithPinnedStyles(
			playgroundFiles.viewModelAsClass,
			asTheAncestorsWrote,
		);

		// The framework dislikes neither form — it reports only what THIS project
		// said it does not write.
		expect(gateway.map((message) => message.ruleId)).toEqual(["lanka/layer-style"]);
		expect(viewModel.map((message) => message.ruleId)).toEqual(["lanka/layer-style"]);
	});
});
