import { useEffect } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { StoreApi, UseBoundStore } from "zustand";

export interface IAtlasDeviceScreenProps {
	useMissionsVM: UseBoundStore<StoreApi<IAtlasMissionsState & IAtlasMissionsActions>>;
}

/**
 * The board on a device, and the same ViewModel a browser renders.
 *
 * `FlatList` and `Text` instead of `ul` and `span`, and that is the ENTIRE
 * difference. The state, the actions, the gateway, the scenarios and the
 * failures are the ones every other application in this folder uses, which is
 * what the shared package exists to demonstrate.
 *
 * It reads one hook and owns nothing — no loading flag of its own, no retry, no
 * decision about what a failure means.
 */
export const AtlasDeviceScreen = ({ useMissionsVM }: IAtlasDeviceScreenProps): JSX.Element => {
	const { isLoading, error, fetchMissions, rows, completeMission } = useMissionsVM();

	useEffect(() => {
		void fetchMissions();
	}, [fetchMissions]);

	if (isLoading) return <ActivityIndicator accessibilityLabel="Loading the board" />;

	return (
		<View accessibilityLabel="Missions">
			{error !== null && <Text accessibilityRole="alert">{error}</Text>}

			<FlatList
				data={rows().items}
				keyExtractor={(mission) => mission.id}
				renderItem={({ item }) => (
					<Text
						accessibilityRole="button"
						onPress={() => void completeMission(item.id)}
					>{`${item.code} ${item.title} — ${item.status}`}</Text>
				)}
			/>
		</View>
	);
};
