import AsyncStorage from "@react-native-async-storage/async-storage";
import { MMKV } from "react-native-mmkv";
import { SafeAreaView, Text } from "react-native";
import { createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { AtlasDeviceScreen } from "../Modules/AtlasBoardModule/AtlasDeviceScreen";
import { startAtlasDevice } from "../startAtlasDevice";
import type { IAtlasDevice } from "../startAtlasDevice";
import type { JSX } from "react";

/**
 * The engines, constructed once at module level.
 *
 * An MMKV instance is a native handle: constructing one per render would open a
 * file per render. The adapters never import any of these — every one is a PEER
 * dependency handed in — which is what lets a test run this application's logic
 * on a machine with nothing native on it.
 */
const engines = {
	mmkv: new MMKV({ id: "atlas" }),
	keychain: SecureStore,
	asyncStorage: AsyncStorage,
};

/**
 * Atlas on a device.
 *
 * The start is asynchronous and the first FRAME is not: `startAtlasDevice` reads
 * what it needs to choose a screen synchronously, before anything is awaited, so
 * a returning person sees the board rather than the sign-in screen followed by
 * the board.
 *
 * What is rendered while the rest of start-up finishes is a splash, deliberately
 * — and that is the honest version of waiting rather than a flash of the wrong
 * screen.
 */
export const AtlasDeviceApp = (): JSX.Element => {
	const [device, setDevice] = useState<IAtlasDevice | null>(null);

	useEffect(() => {
		let started: IAtlasDevice | null = null;
		void startAtlasDevice({ apiBaseUrl: "http://127.0.0.1:4380/api", engines }).then(
			(ready) => {
				started = ready;
				setDevice(ready);
			},
		);

		// A device application is mounted once, and stopping on unmount is still
		// the right shape: a socket and a framework instance that outlive their
		// screen are a leak whether or not this screen is ever unmounted.
		return () => started?.stop();
	}, []);

	const useMissionsVM = useMemo(
		() => (device === null ? null : createAtlasMissionsVM(device.app.missionGateway)),
		[device],
	);

	if (device === null || useMissionsVM === null) {
		return (
			<SafeAreaView>
				<Text accessibilityRole="progressbar">Starting Atlas…</Text>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView>
			<Text accessibilityRole="header">{device.session.operator() ?? "Atlas"}</Text>
			<AtlasDeviceScreen useMissionsVM={useMissionsVM} />
		</SafeAreaView>
	);
};
