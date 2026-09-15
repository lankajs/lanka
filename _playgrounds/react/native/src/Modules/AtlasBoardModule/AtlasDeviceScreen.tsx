import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { formatAtlasMissionLine, useAtlasMissionsOnMount } from "@lanka-playgrounds/react-shared";
import type { JSX } from "react";
import type { TAtlasMissionsVM } from "@lanka-playgrounds/react-shared";

export interface IAtlasDeviceScreenProps {
	missionsVM: TAtlasMissionsVM;
}

/**
 * The board on a device, and the same ViewModel a browser renders.
 *
 * `FlatList` and `Text` instead of `ul` and `span`, and that is the ENTIRE
 * difference. The state, the actions, the gateway, the scenarios and the
 * failures are the ones every other application in this folder uses, which is
 * what the shared package exists to demonstrate.
 *
 * The read is `@lanka-playgrounds/react-shared`'s — the same hook the browser
 * application calls, effect and all. It comes from the package's ROOT entry and
 * not `/dom`: this program has no `<input>` in its JSX, so a barrel carrying one
 * would not typecheck here. The split is the honest shape of an ecosystem that
 * spans two renderers.
 */
export const AtlasDeviceScreen = ({ missionsVM }: IAtlasDeviceScreenProps): JSX.Element => {
	const { isLoading, error, rows, completeMission } = useAtlasMissionsOnMount(missionsVM);

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
					>{`${formatAtlasMissionLine(item)} — ${item.status}`}</Text>
				)}
			/>
		</View>
	);
};
