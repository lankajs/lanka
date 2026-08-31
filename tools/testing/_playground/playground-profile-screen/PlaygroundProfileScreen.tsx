import type { IPlaygroundProfileState } from "../_interfaces/IPlaygroundProfileState";

/** The screen a consumer would render in their own test. */
export interface IPlaygroundProfileScreenProps {
	useProfileVM: () => IPlaygroundProfileState;
}

export const PlaygroundProfileScreen = ({ useProfileVM }: IPlaygroundProfileScreenProps) => {
	const { profile, error } = useProfileVM();

	if (error !== null) return <p role="alert">{error}</p>;
	return <p>{profile?.name ?? "nobody"}</p>;
};
