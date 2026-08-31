/**
 * Checks the five extension points against who actually occupies them.
 *
 * The canon is `skills/surface/SKILL.md` §4; this is its executable half.
 *
 * ## Two failures, in opposite directions
 *
 * 1. **A point nobody occupies.** An extension point declared before anything
 *    plugs into it describes an imagined need while costing real support: it has
 *    to keep working, keep its shape and keep being documented, for nobody.
 * 2. **A plugin reaching past the points.** Core knows a plugin by SHAPE, and
 *    the shape is these five doors. A sixth door that grew without being
 *    declared is load-bearing before anyone decides it should be.
 *
 * The occupant list is part of the declaration, not derived from the scan: a
 * list derived from what it measures agrees with itself and checks nothing.
 *
 * Run: node scripts/check-extension-points.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * The five doors, each with the call that goes through it and who goes through.
 *
 * `occupants` are package directories. A point occupied by core itself is not a
 * point — it is a function call.
 */
export const EXTENSION_POINTS = [
	{
		name: "useRequestMiddleware",
		what: "wraps every request: retry, the idempotency key, the CSRF header, auth refresh",
		call: /\.useRequestMiddleware\s*\(/,
		occupants: ["plugins/http"],
	},
	{
		name: "inFlight",
		what: "answers whether anything else is on the wire, so speculative work can stand down",
		call: /\.inFlight\.(getActiveCount|subscribe)\s*\(/,
		// Two occupants, and they read it differently: prefetch ASKS before doing
		// speculative work, the inspector WATCHES to draw the number. A point that
		// holds both is a point worth having.
		occupants: ["plugins/devtools", "plugins/prefetch"],
	},
	{
		name: "lankaEventBus.addMiddleware",
		what: "sees every scenario as it passes, without any of them knowing",
		call: /\.addMiddleware\s*\(/,
		occupants: ["plugins/devtools"],
	},
	{
		name: "lankaLogger.addSink",
		what: "takes the log somewhere other than the console",
		call: /lankaLogger\.addSink\s*\(/,
		occupants: ["plugins/devtools"],
	},
	{
		name: "use(plugin)",
		what: "the door the other four are reached through",
		call: /\binstall\s*[(:]/,
		occupants: [
			"plugins/http",
			"plugins/prefetch",
			"plugins/devtools",
			"plugins/sse",
			"plugins/bootstrap-steps",
		],
	},
];

/** Every plugin source file, by package directory. */
export const pluginSources = (root = ".") => {
	const files = execSync("git ls-files plugins", { cwd: root, encoding: "utf8" })
		.trim()
		.split("\n")
		.filter((path) => /^plugins\/[^/]+\/src\/.*\.tsx?$/.test(path))
		.filter((path) => !/\.test\.tsx?$/.test(path))
		.filter((path) => existsSync(path));

	const byPackage = new Map();
	for (const file of files) {
		const pkg = file.split("/").slice(0, 2).join("/");
		byPackage.set(pkg, (byPackage.get(pkg) ?? "") + readFileSync(file, "utf8"));
	}
	return byPackage;
};

/** What diverges: an empty point, and an occupant nobody declared. */
export const divergences = (points, sources) => {
	const problems = [];

	for (const point of points) {
		const actual = [...sources]
			.filter(([, text]) => point.call.test(text))
			.map(([pkg]) => pkg)
			.sort();
		const declared = [...point.occupants].sort();

		for (const pkg of actual.filter((p) => !declared.includes(p))) {
			problems.push({
				tag: "undeclared-occupant",
				where: `${pkg} → ${point.name}`,
				message:
					"occupies a point it is not listed against. Add it here if the point is " +
					"meant to hold several, or say why this plugin reaches for it.",
			});
		}

		for (const pkg of declared.filter((p) => !actual.includes(p))) {
			problems.push({
				tag: "absent-occupant",
				where: `${pkg} → ${point.name}`,
				message:
					"is listed against a point it no longer uses. Either the plugin stopped " +
					"needing the door, or the call was renamed and this list stopped seeing it.",
			});
		}

		if (declared.length === 0) {
			problems.push({
				tag: "point-without-occupant",
				where: point.name,
				message:
					"is declared and nobody plugs into it. An extension point with no occupant " +
					"describes an imagined need while costing real support: add it with its " +
					"first occupant, not before.",
			});
		}
	}

	return problems;
};

const main = () => {
	const problems = divergences(EXTENSION_POINTS, pluginSources());

	if (problems.length > 0) {
		console.error(
			`THE EXTENSION POINTS DIVERGE FROM THE CANON (${String(problems.length)})\n\n` +
				problems.map((p) => `[${p.tag}] ${p.where}\n    ${p.message}`).join("\n\n") +
				"\n\nCanon: skills/surface/SKILL.md",
		);
		process.exit(1);
	}

	console.log(`extension points follow the canon: ${String(EXTENSION_POINTS.length)} points`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
