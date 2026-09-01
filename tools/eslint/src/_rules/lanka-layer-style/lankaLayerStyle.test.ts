import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { lankaLayerStyle } from "./lankaLayerStyle";

/**
 * The failing fixtures matter more than the passing ones: a rule that reports
 * nothing passes every "valid" case ever written.
 *
 * The first valid case is the one that keeps this rule from breaking a project on
 * upgrade — switched on with nothing pinned, it must say nothing at all.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("layer-style", lankaLayerStyle, {
	valid: [
		{
			name: "on, with nothing pinned: the framework has no opinion",
			code: `class ThingsGateway extends ALankaGateway {}; const vm = createLankaVM({});`,
		},
		{
			name: "the pinned style itself",
			options: [{ gateway: "class", viewmodel: "functional" }],
			code: `class ThingsGateway extends ALankaGateway {}; const useGapVM = createLankaVM({});`,
		},
		{
			name: "a role left at both accepts either form",
			options: [{ gateway: "class", scenario: "both" }],
			code: `class ThingCompleted extends ALankaScenario {}; const other = createLankaScenario({});`,
		},
		{
			name: "an unrelated class and an unrelated call",
			options: [{ gateway: "class" }],
			code: `class ThingCard extends Component {}; const rows = createTable({});`,
		},
		{
			name: "a base reached through a namespace, which the rule cannot name",
			options: [{ gateway: "functional", request: "functional" }],
			code: `class ThingsGateway extends lanka.ALankaGateway {}; new lanka.LankaFetchJsonRequest({});`,
		},
		{
			name: "a factory reached through a namespace",
			options: [{ gateway: "class" }],
			code: `const thingsGateway = lanka.createLankaGateway({});`,
		},
		{
			name: "a declared role with no style stays at both",
			options: [
				{ roles: { repository: { base: "ARepository", factory: "createRepository" } } },
			],
			code: `class ThingRepository extends ARepository {}; const other = createRepository({});`,
		},
		{
			name: "a project's own role, in the style it chose",
			options: [
				{
					roles: {
						repository: {
							base: "ARepository",
							factory: "createRepository",
							style: "class",
						},
					},
				},
			],
			code: `class ThingRepository extends ARepository {}`,
		},
	],
	invalid: [
		{
			name: "the functional form where the project writes classes",
			options: [{ gateway: "class" }],
			code: `const thingsGateway = createLankaGateway({});`,
			errors: [{ messageId: "functionalExcluded" }],
		},
		{
			name: "the class form where the project writes factories",
			options: [{ viewmodel: "functional" }],
			code: `class ThingVM extends ALankaVM {}`,
			errors: [{ messageId: "classExcluded" }],
		},
		{
			name: "every ViewModel factory counts as the functional form",
			options: [{ viewmodel: "class" }],
			code: `const useLazy = createLazyLankaVM({}); const useStats = createStatelessLankaVM({});`,
			errors: [{ messageId: "functionalExcluded" }, { messageId: "functionalExcluded" }],
		},
		{
			name: "a request kind has no base: constructing one IS the class form",
			options: [{ request: "functional" }],
			code: `const request = new LankaFetchJsonRequest({ transport });`,
			errors: [{ messageId: "classExcluded" }],
		},
		{
			name: "a class expression is a class, wherever it is written",
			options: [{ singleton: "functional" }],
			code: `const Clock = class extends ALankaSingleton {};`,
			errors: [{ messageId: "classExcluded" }],
		},
		{
			name: "a declared role whose class form is a construction, not a base",
			options: [{ roles: { command: { construct: "ThingCommand", style: "functional" } } }],
			code: `const command = new ThingCommand();`,
			errors: [{ messageId: "classExcluded" }],
		},
		{
			name: "a project's own role, in the style it excluded",
			options: [
				{
					roles: {
						repository: {
							base: "ARepository",
							factory: "createRepository",
							style: "functional",
						},
					},
				},
			],
			code: `class ThingRepository extends ARepository {}`,
			errors: [{ messageId: "classExcluded" }],
		},
	],
});
