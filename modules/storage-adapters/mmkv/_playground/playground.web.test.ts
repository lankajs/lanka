// @vitest-environment jsdom
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createMMKV } from "react-native-mmkv/lib/createMMKV/createMMKV.web.js";
import { createLankaMmkvAdapter } from "../src/index";

/**
 * The same adapter over MMKV's WEB build — the evidence for declaring it for the
 * browser.
 *
 * react-native-mmkv ships a web implementation that a web bundler picks by the
 * `.web.js` extension (Expo web, react-native-web) and that keeps its rows in
 * `localStorage`. The adapter never constructs an engine, so it runs wherever
 * one is handed to it; what decides the declaration is whether the ENGINE keeps
 * the port's promises there. This runs every clause against the real web build,
 * in jsdom.
 *
 * Imported by its file rather than by the package name, because node resolves
 * the package to its native entry; the web bundler's extension rule is the one
 * step this suite does by hand. A fresh instance id per scene is the empty
 * namespace the suite asks for: MMKV's web build prefixes every key with it.
 */
let instance = 0;

lankaStorageAdapterConformance({
	vendor: "MMKV v4, web build",
	create: () =>
		createLankaMmkvAdapter(createMMKV({ id: `lanka-web-${String((instance += 1))}` })),
	sync: true,
});
