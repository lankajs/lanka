import { ALankaScenario } from "../../_abstractions/lanka-scenario/ALankaScenario";
import type { ILankaScenario } from "../../_interfaces/ILankaScenario";

/** What a scenario is: three names and nothing else. */
export interface ILankaScenarioConfig {
	/** The scenario's name, and the key it is found by. */
	name: string;
	/** The event type on the bus. */
	eventType: string;
	/** The event data's type name — for the bus metadata. */
	dataTypeName: string;
	/** Opts out of self-registration, as `skipAutoRegistration` does on a class. */
	skipAutoRegistration?: boolean;
}

/**
 * A scenario, without writing a class whose body is data.
 *
 * The class style is right where a scenario has behaviour — an `initialize` that
 * warms something, a `cleanup` that lets go. Most have neither: in the two
 * applications this framework grew out of, every scenario is a class holding
 * three `readonly` fields and nothing else.
 *
 * One implementation: this builds a subclass of `ALankaScenario`, so
 * self-registration, `trigger` and `subscribe` are the same code either way.
 */
export const createLankaScenario = <TData = void>(
	config: ILankaScenarioConfig,
): ILankaScenario<TData> => {
	class FunctionalScenario extends ALankaScenario<TData> {
		public static override skipAutoRegistration = config.skipAutoRegistration ?? false;

		public readonly name = config.name;
		public readonly eventType = config.eventType;
		public readonly dataTypeName = config.dataTypeName;
	}

	return new FunctionalScenario();
};
