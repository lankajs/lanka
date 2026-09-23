import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Angular binding, run against Angular 22.
 *
 * `resolve.dedupe` is the whole mechanism. The binding and the shared scenes are
 * workspace source, each with an Angular of its own beside it; deduped, every
 * import of Angular — the binding's, the scenes', the testing library's —
 * resolves from THIS application's root, which installed 22. The first scene
 * asserts `VERSION.major`, so a dedupe that stopped working fails rather than
 * running everything against the wrong major.
 */
const ANGULAR = [
	"@angular/core",
	"@angular/common",
	"@angular/compiler",
	"@angular/platform-browser",
	"@angular/router",
	"@testing-library/angular",
	"@testing-library/dom",
	"rxjs",
];

export default defineConfig({
	resolve: { alias: lankaDiAlias(), dedupe: ANGULAR },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: [
			"../../../tools/testing/src/setupTests.ts",
			"@lanka-playgrounds/versions-shared/setup-angular",
		],
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
		// Angular Testing Library is loaded by node unless inlined, and node resolves
		// ITS Angular imports from wherever the store linked it — past the dedupe.
		// Inlined, its imports go through the same resolution as the binding's.
		server: { deps: { inline: [/@testing-library[\\/]angular/] } },
	},
});
