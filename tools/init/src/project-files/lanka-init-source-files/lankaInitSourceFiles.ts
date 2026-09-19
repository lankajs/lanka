import { lankaInitScreenFile } from "../lanka-init-screen-file/lankaInitScreenFile";
import type { ILankaInitChoices } from "../../_interfaces/ILankaInitChoices";
import type { ILankaInitFile } from "../../_interfaces/ILankaInitFile";

/**
 * The application's own code: the layers, with one feature written through them.
 *
 * Everything here is text written INTO somebody else's repository, so two rules
 * hold over all of it. Relative paths are the CONSUMER'S depth and never this
 * package's — `../../Core/Interfaces/ITodo` is counted from where the file lands
 * — and every file is a file they are meant to delete: a starter exists to be
 * replaced by the real thing, and the one it demonstrates is the smallest
 * feature that still crosses every layer.
 */

const HOST = (apiBaseUrl: string): string => `import type { ILankaHost } from "lanka";

/**
 * What this application supplies to the framework.
 *
 * All four fields are required on purpose: each is a product decision the
 * framework cannot make for you — the copy is yours, the base URL is your
 * build's — and a missing one is a compile error here rather than an
 * \`undefined\` inside a request URL.
 *
 * One object, read in two places: the start-up call, and \`.lanka/Host.ts\`,
 * which is what the framework reads. Two copies would be two answers to the same
 * question, and they would disagree the first time somebody edited one.
 */
export const appHost: ILankaHost = {
	apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
	httpErrorMessage: (status: number): string => \`The server refused the request (\${status}).\`,
	networkErrorMessage: (): string => "No connection.",
	timeoutErrorMessage: (): string => "The server took too long to answer.",
};
`;

const TODO = `/** One row of the list this starter loads. */
export interface ITodo {
	readonly id: number;
	readonly title: string;
	readonly done: boolean;
}
`;

/**
 * One schema per vendor, and the validator that reads it.
 *
 * The validators are called BY NAME rather than through the gateway's
 * \`validationService\`, which is what every one of their guides shows. Two of
 * them — TypeBox and Effect — publish a validator typed by their own schema
 * kind, because their libraries publish no Standard Schema for the port to take;
 * a starter written against the port would not compile for those two, and a
 * starter that compiles for four of six is worse than none.
 */
const SCHEMAS: Readonly<Record<string, { readonly validator: string; readonly text: string }>> = {
	zod: {
		validator: 'import { lankaZodValidator } from "@lankajs/zod";',
		text: `import { z } from "zod";

/** Declared at MODULE level: a schema built per call is a new object per call. */
export const todoSchema = z.object({
	id: z.number(),
	title: z.string(),
	done: z.boolean(),
});

export const todoListSchema = z.array(todoSchema);
`,
	},
	valibot: {
		validator: 'import { lankaValibotValidator } from "@lankajs/valibot";',
		text: `import * as v from "valibot";

/** Declared at MODULE level: a schema built per call is a new object per call. */
export const todoSchema = v.object({
	id: v.number(),
	title: v.string(),
	done: v.boolean(),
});

export const todoListSchema = v.array(todoSchema);
`,
	},
	arktype: {
		validator: 'import { lankaArkTypeValidator } from "@lankajs/arktype";',
		text: `import { type } from "arktype";

/** Declared at MODULE level: a schema built per call is a new object per call. */
export const todoSchema = type({
	id: "number",
	title: "string",
	done: "boolean",
});

export const todoListSchema = todoSchema.array();
`,
	},
	yup: {
		validator: 'import { lankaYupValidator } from "@lankajs/yup";',
		text: `import * as yup from "yup";

/** Declared at MODULE level: a schema built per call is a new object per call. */
export const todoSchema = yup.object({
	id: yup.number().required(),
	title: yup.string().required(),
	done: yup.boolean().required(),
});

export const todoListSchema = yup.array(todoSchema).required();
`,
	},
	typebox: {
		validator: 'import { lankaTypeBoxValidator } from "@lankajs/typebox";',
		text: `import { Type } from "@sinclair/typebox";

/** Declared at MODULE level: the compiled checker is cached per schema object. */
export const todoSchema = Type.Object({
	id: Type.Number(),
	title: Type.String(),
	done: Type.Boolean(),
});

export const todoListSchema = Type.Array(todoSchema);
`,
	},
	effect: {
		validator: 'import { lankaEffectValidator } from "@lankajs/effect";',
		text: `import { Schema } from "effect";

/** Declared at MODULE level: a schema built per call is a new cache key. */
export const todoSchema = Schema.Struct({
	id: Schema.Number,
	title: Schema.String,
	done: Schema.Boolean,
});

export const todoListSchema = Schema.Array(todoSchema);
`,
	},
};

/** The name a schema is read with, derived from the import line beside it. */
const validatorName = (importLine: string): string =>
	/\{ (\w+) \}/.exec(importLine)?.[1] ?? "lankaStandardValidator";

const GATEWAY_HEAD = `import { ALankaGateway } from "lanka/gateway";`;

const GATEWAY_DOC = `
/**
 * Where the todos come from, and nothing else.
 *
 * A gateway states the endpoints this application has: no state, no retry, and
 * no decision about what a failure means. Those belong to the ViewModel that
 * calls it, which is why gateways stay short.
 *
 * It is resolved BY NAME — nothing imports this file except the barrel in
 * \`.lanka/\` — so a test can put a double in its place without the screen
 * learning about it.
 */`;

const gatewayText = (validator: string): string => {
	const schema = SCHEMAS[validator];

	if (schema === undefined) {
		return `${GATEWAY_HEAD}
import type { ITodo } from "../../Core/Interfaces/ITodo";
${GATEWAY_DOC}
export class TodoGateway extends ALankaGateway {
	public constructor() {
		super({ basePath: "/todos" });
	}

	public list(): Promise<readonly ITodo[]> {
		return this.request<readonly ITodo[]>(this.endpoint());
	}
}
`;
	}

	return `${GATEWAY_HEAD}
${schema.validator}
import { todoListSchema } from "../../Core/Validation/todoSchema";
import type { ITodo } from "../../Core/Interfaces/ITodo";
${GATEWAY_DOC}
export class TodoGateway extends ALankaGateway {
	public constructor() {
		super({ basePath: "/todos" });
	}

	public async list(): Promise<readonly ITodo[]> {
		const body = await this.request<unknown>(this.endpoint());

		// The third argument is a LABEL. It is what turns "invalid response" into
		// "which call", in the error and in the log.
		return ${validatorName(schema.validator)}.validate(todoListSchema, body, "todos.list");
	}
}
`;
};

const SCENARIO = `import { ALankaScenario } from "lanka/scenario";

/** What the fact carries. */
export interface ITodoCompleted {
	readonly id: number;
}

/**
 * A fact, not a command: \`TodoCompleted\`, never \`CompleteTodo\`.
 *
 * Whoever changes something triggers it; whoever cares subscribes. Neither
 * screen imports the other, which is the whole reason this layer exists.
 */
export class TodoCompleted extends ALankaScenario<ITodoCompleted> {
	public readonly name = "TodoCompleted";
	public readonly eventType = "todo:completed";
	public readonly dataTypeName = "ITodoCompleted";
}

/**
 * The single instance, beside its class.
 *
 * A second instance is a second event nobody listens to — silence rather than an
 * error, which is the expensive kind of mistake.
 */
export const todoCompleted = new TodoCompleted();
`;

const VIEW_MODEL = `import { createLankaVM } from "lanka/viewmodel";
import { lankaGateways } from "lanka/locator";
import { todoCompleted } from "../Scenarios/TodoCompleted/TodoCompleted";
import type { ITodo } from "../Core/Interfaces/ITodo";
import type { TodoGateway } from "../Gateways/TodoGateway/TodoGateway";

export interface ITodoState {
	todos: readonly ITodo[];
	isLoading: boolean;
	/** The sentence to show. The host wrote it; this only decides when. */
	error: string | null;
}

export interface ITodoActions {
	load: () => Promise<void>;
	complete: (id: number) => void;
}

/**
 * The screen's state and the actions that change it.
 *
 * Three things worth reading:
 *
 * - **The gateway arrives by NAME.** \`lankaGateways.todoGateway\` is typed from
 *   the export line in \`.lanka/Gateways.ts\`, so there is nothing to register
 *   and nothing to import.
 * - **The failure is caught here.** A gateway states endpoints; what a refusal
 *   MEANS to this screen is this file's decision.
 * - **The scenario is both triggered and heard.** A second screen reacting to
 *   \`TodoCompleted\` needs no change here, and this one needs no change for it.
 */
export const todoVM = createLankaVM<ITodoState, ITodoActions, { todoGateway: TodoGateway }>({
	name: "TodoVM",
	states: { todos: [], isLoading: false, error: null },
	gateways: () => ({ todoGateway: lankaGateways.todoGateway }),

	createActions: ({ set, get, gateways, trigger }) => ({
		load: async () => {
			set({ isLoading: true, error: null });

			try {
				set({ todos: await gateways.todoGateway.list() });
			} catch (failure) {
				set({ error: failure instanceof Error ? failure.message : "Something went wrong." });
			} finally {
				set({ isLoading: false });
			}
		},

		complete: (id: number) => {
			set({ todos: get().todos.map((todo) => (todo.id === id ? { ...todo, done: true } : todo)) });
			trigger(todoCompleted, { id });
		},
	}),

	scenarioHandlers: [
		{
			scenario: todoCompleted,
			handler:
				({ set, get }) =>
				(data?: { id: number }) => {
					if (data === undefined) return;

					set({
						todos: get().todos.map((todo) =>
							todo.id === data.id ? { ...todo, done: true } : todo,
						),
					});
				},
		},
	],
});
`;

const startAppText = (usesHttp: boolean): string => `import { startLanka } from "lanka";
${usesHttp ? 'import { lankaHttp } from "@lankajs/plugin-http";\n' : ""}import { appHost } from "./Core/Configs/appHost";
import type { ILankaInstance } from "lanka/bootstrap";

/**
 * The whole start-up, in one file and with nothing else in it.
 *
 * \`startLanka\` is \`createLanka\` and \`bootstrap\` in the order that works.
 * Write the two out when something has to happen BETWEEN them — registering a
 * singleton whose construction reads a service's result, say.
 *
 * Call it once, at the top level of your entry file.${
		usesHttp
			? `
 *
 * \`lankaHttp()\` is installed with no policy yet. Retry, auth refresh, the CSRF
 * header and idempotency keys are all configuration on that one call — the
 * plugin's guide has each of them, and retry without an idempotency key is
 * refused at start-up rather than on the first retry.`
			: ""
 }
 */
export const startApp = (): Promise<ILankaInstance> =>
	startLanka({
		host: appHost,${usesHttp ? "\n\t\tplugins: [lankaHttp()]," : ""}
	});
`;

/** The schema, as a list of nothing or one: `none` is an answer, not a branch. */
const schemaFile = (choices: ILankaInitChoices): readonly ILankaInitFile[] => {
	const schema = SCHEMAS[choices.validator.id];

	if (schema === undefined) return [];

	return [
		{
			path: "src/Core/Validation/todoSchema.ts",
			text: schema.text,
			gist: `the response's shape, in ${choices.validator.title}`,
		},
	];
};

/**
 * Every file of the application itself, for one set of choices.
 *
 * The list is the same whichever template this is, with two exceptions that are
 * both answers rather than branches: the schema file exists when a validator was
 * chosen, and the screen is whatever the binding reads.
 */
export const lankaInitSourceFiles = (choices: ILankaInitChoices): readonly ILankaInitFile[] => {
	return [
		{
			path: "src/Core/Configs/appHost.ts",
			text: HOST(choices.apiBaseUrl),
			gist: "the four things the framework cannot decide for you",
		},
		{
			path: "src/Core/Interfaces/ITodo.ts",
			text: TODO,
			gist: "the one shape this starter has",
		},
		...schemaFile(choices),
		{
			path: "src/Gateways/TodoGateway/TodoGateway.ts",
			text: gatewayText(choices.validator.id),
			gist: "the endpoints, and nothing else",
		},
		{
			path: "src/Scenarios/TodoCompleted/TodoCompleted.ts",
			text: SCENARIO,
			gist: "a fact two screens can share without importing each other",
		},
		{
			path: "src/ViewModels/todoVM.ts",
			text: VIEW_MODEL,
			gist: "the state, the actions and what they react to",
		},
		{
			path: "src/startApp.ts",
			text: startAppText(choices.transport.id === "http"),
			gist: "one call: create, install the plugins, bootstrap",
		},
		...lankaInitScreenFile(choices),
	];
};
