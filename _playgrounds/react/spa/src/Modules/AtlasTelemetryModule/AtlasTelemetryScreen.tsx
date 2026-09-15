import type { ILankaReadableVM } from "lanka/viewmodel";
import { useLankaVM } from "@lankajs/react";
import { useEffect } from "react";
import type { IAtlasTelemetryActions, IAtlasTelemetryState } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { TLazyLankaVM } from "lanka/viewmodel";

export interface IAtlasTelemetryScreenProps {
	/**
	 * A LAZY hook: a store that does not exist until this screen reads it, plus
	 * the `dispose()` that is the price of that.
	 */
	telemetryVM: TLazyLankaVM<
		ILankaReadableVM<IAtlasTelemetryState & IAtlasTelemetryActions>,
		IAtlasTelemetryState & IAtlasTelemetryActions
	>;
}

/**
 * The telemetry panel — behind a route most sessions never open.
 *
 * Its ViewModel is LAZY, so nothing is built until this component mounts. The
 * duty that comes with that is the `dispose()` below: a lazy ViewModel
 * subscribes to scenarios on first use, and without explicit disposal that
 * subscription outlives the screen and keeps reacting to facts about a panel
 * nobody is looking at.
 */
export const AtlasTelemetryScreen = ({ telemetryVM }: IAtlasTelemetryScreenProps): JSX.Element => {
	const { telemetry, error, refusal, fetchTelemetry, fetchRestricted } = useLankaVM(telemetryVM);

	useEffect(() => {
		void fetchTelemetry();

		return () => {
			telemetryVM.dispose();
		};
	}, [fetchTelemetry, telemetryVM]);

	return (
		<section aria-label="Telemetry">
			{error !== null && <p role="alert">{error}</p>}
			<p data-testid="telemetry">
				{telemetry === null ? "no telemetry yet" : `${telemetry.done} done`}
			</p>
			<button type="button" onClick={() => void fetchRestricted()}>
				Ask for the restricted stream
			</button>
			{refusal !== null && <p data-testid="refusal">{refusal}</p>}
		</section>
	);
};
