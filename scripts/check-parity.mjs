/**
 * Checks that every ROLE is written in both styles over one implementation.
 *
 * The canon is `skills/parity/SKILL.md`; this is its executable half. What it
 * defends is the failure React made famous: two styles of one thing, one of them
 * quietly falling behind until it is dead — not by a decision, by a backlog.
 *
 * Run: node scripts/check-parity.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * The roles, and the two forms each is written in.
 *
 * `context` is the interface the functional style receives; a role without one
 * hands over nothing but its config, and the hooks check has nothing to compare.
 * `demonstrate` is the playground directory where both styles must appear.
 */
export const ROLES = [
	{
		name: "gateway",
		base: {
			name: "ALankaGateway",
			file: "core/src/gateway/_abstractions/lanka-gateway/ALankaGateway.ts",
		},
		factory: {
			name: "createLankaGateway",
			file: "core/src/gateway/_factories/create-lanka-gateway/createLankaGateway.ts",
		},
		context: "core/src/gateway/_interfaces/ILankaGatewayContext.ts",
		demonstrate: "core/_playground",
	},
	{
		name: "viewmodel",
		base: { name: "ALankaVM", file: "core/src/viewmodel/_abstractions/lanka-vm/ALankaVM.ts" },
		factory: {
			name: "createLankaVM",
			file: "core/src/viewmodel/_factories/create-lanka-vm/createLankaVM.ts",
		},
		context: "core/src/viewmodel/_interfaces/ILankaVMContext.ts",
		demonstrate: "core/_playground",
	},
	{
		name: "scenario",
		base: {
			name: "ALankaScenario",
			file: "core/src/scenario/_abstractions/lanka-scenario/ALankaScenario.ts",
		},
		factory: {
			name: "createLankaScenario",
			file: "core/src/scenario/_factories/create-lanka-scenario/createLankaScenario.ts",
		},
		context: null,
		demonstrate: "core/_playground",
	},
	{
		name: "shared-store",
		base: {
			name: "ALankaSharedStore",
			file: "core/src/viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore.ts",
		},
		factory: {
			name: "createLankaSharedStore",
			file: "core/src/viewmodel/_factories/create-lanka-shared-store/createLankaSharedStore.ts",
		},
		context: null,
		demonstrate: "core/_playground",
	},
	{
		name: "singleton",
		base: {
			name: "ALankaSingleton",
			file: "core/src/locator/singleton/_abstractions/lanka-singleton/ALankaSingleton.ts",
		},
		factory: {
			name: "createLankaSingleton",
			file: "core/src/locator/singleton/_factories/create-lanka-singleton/createLankaSingleton.ts",
		},
		context: null,
		demonstrate: "core/_playground",
	},
	{
		name: "request",
		base: {
			name: "LankaFetchJsonRequest",
			file: "core/src/gateway/request/lanka-fetch-json-request/LankaFetchJsonRequest.ts",
		},
		factory: {
			name: "createLankaFetchJsonRequest",
			file: "core/src/gateway/request/_factories/create-lanka-fetch-json-request/createLankaFetchJsonRequest.ts",
		},
		context: null,
		demonstrate: "core/_playground",
	},
	{
		name: "sse-bridge",
		base: {
			name: "ALankaSseBridge",
			file: "plugins/sse/src/_abstractions/lanka-sse-bridge/ALankaSseBridge.ts",
		},
		factory: {
			name: "createLankaSseBridge",
			file: "plugins/sse/src/_factories/create-lanka-sse-bridge/createLankaSseBridge.ts",
		},
		context: "plugins/sse/src/_interfaces/ILankaSseBridgeContext.ts",
		demonstrate: "plugins/sse/_playground",
	},
];

/**
 * The two roles whose functional style is an INTERFACE, not a factory.
 *
 * A plugin and a bootstrap step are handed to the framework as an object
 * satisfying a contract — `{ name, install }` — which is the ecosystem's shape
 * and needs no second name. The class exists beside it for a consumer who wants
 * `this`, `super` and a place to keep state. So the pair here is base +
 * interface, and what is checked is that both exist and the class is exercised.
 */
export const INTERFACE_ROLES = [
	{
		name: "plugin",
		base: {
			name: "ALankaPlugin",
			file: "core/src/bootstrap/_abstractions/lanka-plugin/ALankaPlugin.ts",
		},
		contract: { name: "ILankaPlugin", file: "core/src/bootstrap/ILankaPlugin.ts" },
		demonstrate: "core/_playground",
	},
	{
		name: "bootstrap-step",
		base: {
			name: "ALankaBootstrapStep",
			file: "plugins/bootstrap-steps/src/_abstractions/lanka-bootstrap-step/ALankaBootstrapStep.ts",
		},
		contract: {
			name: "ILankaBootstrapStepConfig",
			file: "plugins/bootstrap-steps/src/_interfaces/ILankaBootstrapStepConfig.ts",
		},
		demonstrate: "plugins/bootstrap-steps/_playground",
	},
];

/**
 * Every `protected` member a class OFFERS, its own and its base class's.
 *
 * A base that extends another still promises what the other declared — the
 * three ViewModel bases share the four hooks every ViewModel is given — so
 * reading one file would report a surface the language does not.
 */
export const inheritedProtectedMembers = (file) => {
	const source = readFileSync(file, "utf8");
	const names = protectedMembers(source);
	const extended = /export abstract class \w+[^]*?extends (\w+)</.exec(source);
	if (!extended) return names;

	const imported = new RegExp(String.raw`import \{ ${extended[1]} \} from "([^"]+)"`).exec(
		source,
	);
	if (!imported) return names;

	const base = `${file.slice(0, file.lastIndexOf("/"))}/${imported[1]}.ts`.replace(
		/\/[^/]+\/\.\./g,
		"",
	);
	if (!existsSync(base)) return names;

	for (const name of inheritedProtectedMembers(base)) names.add(name);

	return names;
};

/** Every `protected` member a class declares, by name. */
export const protectedMembers = (source) => {
	const found = new Set();

	for (const [, name] of source.matchAll(
		/^\s*protected\s+(?:readonly\s+|abstract\s+|async\s+|override\s+)*([A-Za-z_$][\w$]*)/gm,
	)) {
		found.add(name);
	}

	return found;
};

/** Every field an interface declares, by name. */
export const contextFields = (source) => {
	const body = source.slice(source.indexOf("{"));
	const found = new Set();

	for (const [, name] of body.matchAll(/^\t([A-Za-z_$][\w$]*)(\?)?\s*:/gm)) found.add(name);

	return found;
};

/**
 * Whether a factory is built ON its base rather than beside it.
 *
 * Two spellings, both admitted by the canon: a bridge subclass in the factory's
 * own module, or `defineLankaRole` over an opener written in the role's module.
 * What is forbidden is a factory that reimplements the class — which is how two
 * styles of one thing become two things.
 */
export const buildsOnBase = (source, baseName) =>
	new RegExp(`extends\\s+${baseName}\\b`).test(source) ||
	/\bdefineLankaRole\b/.test(source) ||
	new RegExp(`new\\s+${baseName}\\b`).test(source);

/** Whether a directory's files show a role built BOTH ways. */
export const demonstratesBothStyles = (files, role) => {
	let asClass = false;
	let byCalling = false;

	for (const source of files) {
		if (
			new RegExp(`extends\\s+${role.base.name}\\b`).test(source) ||
			new RegExp(`new\\s+${role.base.name}\\b`).test(source)
		) {
			asClass = true;
		}
		if (role.factory && new RegExp(`\\b${role.factory.name}\\s*[(<]`).test(source)) {
			byCalling = true;
		}
	}

	return { asClass, byCalling };
};

/** Every file the repository tracks and still has on disk. */
const trackedFiles = () =>
	execSync("git ls-files", { encoding: "utf8" })
		.trim()
		.split("\n")
		.filter((path) => existsSync(path));

/** The value names a package's barrels publish. */
export const publishedNames = (files, pkg) => {
	const names = new Set();

	for (const barrel of files.filter(
		(path) => path.startsWith(pkg + "/src/") && path.endsWith("index.ts"),
	)) {
		for (const match of readFileSync(barrel, "utf8").matchAll(/export\s*\{([^}]*)\}/g)) {
			for (const part of match[1].split(",")) {
				const name = part.trim();
				if (name.length === 0 || name.startsWith("type ")) continue;

				names.add(
					name
						.split(/\s+as\s+/)
						.pop()
						.trim(),
				);
			}
		}
	}

	return names;
};

/**
 * Every pair a package publishes, found rather than declared.
 *
 * A pair is a class beside its factory (`LankaPolling` / `createLankaPolling`) or
 * beside its ready-made instance (`LankaStorage` / `lankaStorage`). Derived from
 * the barrels on purpose: a hand-written list covers what somebody remembered,
 * and the point of this check is the pair nobody did.
 */
export const publishedPairs = (names) => {
	const pairs = [];

	for (const name of names) {
		if (!/^A?Lanka[A-Z]/.test(name)) continue;

		const bare = name.replace(/^A/, "");
		const factory = `create${bare}`;
		const instance = bare.charAt(0).toLowerCase() + bare.slice(1);

		if (names.has(factory)) pairs.push({ class: name, other: factory, kind: "factory" });
		else if (names.has(instance))
			pairs.push({ class: name, other: instance, kind: "instance" });
	}

	return pairs;
};

/** Whether a playground drives one side of a pair. */
export const drivesPair = (source, pair) => ({
	asClass: new RegExp(String.raw`(extends|new)\s+${pair.class}\b`).test(source),
	other:
		pair.kind === "factory"
			? new RegExp(String.raw`\b${pair.other}\s*[(<]`).test(source)
			: new RegExp(String.raw`\b${pair.other}\s*\.`).test(source),
});

const problems = [];
const fail = (rule, where, message) => problems.push(`[${rule}] ${where}\n    ${message}`);

const playgroundSources = (dir) =>
	trackedFiles()
		.filter((path) => path.startsWith(dir + "/") && /\.tsx?$/.test(path))
		.map((path) => readFileSync(path, "utf8"));

const run = () => {
	for (const role of ROLES) {
		for (const form of [role.base, role.factory]) {
			if (existsSync(form.file)) continue;

			fail(
				"role-without-pair",
				`${role.name} → ${form.name}`,
				`${form.file} is not there. A role is written in both styles or in neither: ` +
					"half a pair is how one style starts falling behind.",
			);
		}

		if (!existsSync(role.base.file) || !existsSync(role.factory.file)) continue;

		const base = readFileSync(role.base.file, "utf8");
		const factory = readFileSync(role.factory.file, "utf8");

		if (!buildsOnBase(factory, role.base.name)) {
			fail(
				"factory-not-over-base",
				`${role.name} → ${role.factory.name}`,
				`${role.factory.file} neither derives from ${role.base.name} nor goes through ` +
					"`defineLankaRole`. A factory written beside its class is a second " +
					"implementation, and the two drift where a reviewer cannot see it.",
			);
		}

		if (/^\s*public\s+toStyleContext\b/m.test(base)) {
			fail(
				"context-escapes",
				`${role.name} → ${role.base.name}`,
				"the style context is public. It is assembled from the PROTECTED surface, " +
					"so publishing it puts the whole extension surface on every object a " +
					"consumer writes — and takes it back the day it changes.",
			);
		}

		if (role.context && existsSync(role.context)) {
			const declared = inheritedProtectedMembers(role.base.file);

			for (const field of contextFields(readFileSync(role.context, "utf8"))) {
				if (declared.has(field)) continue;

				fail(
					"hooks-diverged",
					`${role.name} → ${field}`,
					`the context offers \`${field}\` and ${role.base.name} has no protected ` +
						"member of that name. A consumer switching styles would have to learn " +
						"the framework twice.",
				);
			}
		}

		const shown = demonstratesBothStyles(playgroundSources(role.demonstrate), role);
		if (!shown.asClass || !shown.byCalling) {
			fail(
				"style-not-demonstrated",
				`${role.name} → ${role.demonstrate}`,
				`the playground builds it ${shown.asClass ? "as a class" : "by calling"} and not ` +
					"the other way. The scene is the cheapest guard there is: it runs both " +
					"styles and asserts the same result, so a capability that reached one of " +
					"them fails a test rather than a review.",
			);
		}
	}

	for (const role of INTERFACE_ROLES) {
		for (const form of [role.base, role.contract]) {
			if (existsSync(form.file)) continue;

			fail(
				"role-without-pair",
				`${role.name} → ${form.name}`,
				`${form.file} is not there. The functional style of this role IS the ` +
					"interface; without it the class is the only way in.",
			);
		}

		if (!existsSync(role.base.file)) continue;

		const shown = demonstratesBothStyles(playgroundSources(role.demonstrate), role);
		if (!shown.asClass) {
			fail(
				"style-not-demonstrated",
				`${role.name} → ${role.demonstrate}`,
				`no playground scene extends ${role.base.name}. The object form is exercised ` +
					"by everything the framework does; the class form is not, unless something " +
					"writes one.",
			);
		}
	}

	pairsChecked = checkEveryPair();

	return problems;
};

/** How many published pairs the last run looked at, for the success line. */
let pairsChecked = 0;

/**
 * Every published pair is driven both ways, whether or not it is a role.
 *
 * The nine roles are declared above and checked by name. This is the other half:
 * a class published beside its factory or its ready-made instance makes a
 * consumer the same promise — reach it either way — and nobody declared it
 * anywhere. So the pairs are read off the barrels, and a new one is covered the
 * day it is published rather than the day somebody remembers this file.
 */
const checkEveryPair = () => {
	let seen = 0;
	const files = trackedFiles();
	const packages = [
		...new Set(
			files
				.filter((path) => /^(core|modules|plugins|tools)\/([^/]+\/)?src\//.test(path))
				.map((path) => path.replace(/\/src\/.*$/, "")),
		),
	];

	// A role reports its own gap under `style-not-demonstrated`; reporting it
	// twice would say the same thing in two voices.
	const roleClasses = new Set(ROLES.map((role) => role.base.name));

	for (const pkg of packages) {
		const playground = playgroundSources(pkg + "/_playground").join("\n");

		for (const pair of publishedPairs(publishedNames(files, pkg))) {
			seen += 1;
			if (roleClasses.has(pair.class)) continue;

			const driven = drivesPair(playground, pair);
			if (driven.asClass && driven.other) continue;

			const missing = [
				driven.asClass ? null : `as a class (\`new ${pair.class}\`)`,
				driven.other ? null : `through \`${pair.other}\``,
			].filter(Boolean);

			fail(
				"pair-not-demonstrated",
				`${pkg} → ${pair.class} / ${pair.other}`,
				`no playground scene reaches it ${missing.join(" or ")}. Publishing both ` +
					"names promises both work; a scene driving one has proved one.",
			);
		}
	}

	return seen;
};

export { run };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	run();

	if (problems.length > 0) {
		console.error(
			`PARITY DIVERGES FROM THE CANON (${String(problems.length)})\n\n` +
				problems.join("\n\n") +
				"\n\nCanon: skills/parity/SKILL.md",
		);
		process.exit(1);
	}

	console.log(
		`both styles reach every role: ${String(ROLES.length + INTERFACE_ROLES.length)} roles, ` +
			`${String(pairsChecked)} published pairs`,
	);
}
