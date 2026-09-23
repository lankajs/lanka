// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createAsyncStorage } from "@react-native-async-storage/async-storage";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createLankaReactNativeAsyncStorageAdapter } from "../src/index";

/**
 * The same adapter over AsyncStorage's WEB build — the evidence for declaring
 * it for the browser.
 *
 * AsyncStorage 3 resolves, off React Native, to an implementation over
 * IndexedDB, which is what Expo web and react-native-web run. The adapter never
 * constructs an engine, so what decides the declaration is whether that engine
 * keeps the port's promises. This runs every clause against the real web build,
 * in jsdom, with `fake-indexeddb` standing in for the browser's IndexedDB — the
 * one piece jsdom does not have.
 *
 * `createAsyncStorage(name)` rather than the default export: each call opens its
 * own database, which is the empty namespace the suite asks for per scene; the
 * default export is one shared store every scene would inherit.
 */
let database = 0;

lankaStorageAdapterConformance({
	vendor: "AsyncStorage 3, web build",
	create: () =>
		createLankaReactNativeAsyncStorageAdapter(
			createAsyncStorage(`lanka-web-${String((database += 1))}`),
		),
});
