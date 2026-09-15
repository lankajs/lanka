import { registerRootComponent } from "expo";
import { AtlasDeviceApp } from "./src/App/AtlasDeviceApp";

/**
 * The entry point Expo requires, and nothing else in it.
 *
 * Every decision lives under `src/`, where a test can import it without a
 * device. This file is named by Expo rather than by this application, which is
 * the same division the Next and Astro applications make with `app/` and
 * `src/pages/`.
 */
registerRootComponent(AtlasDeviceApp);
