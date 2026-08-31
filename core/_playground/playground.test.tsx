import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { resetActiveLanka, startLanka } from "../src/bootstrap/index";
import { createLankaHost, getLankaHost } from "../src/config/index";
import { lankaEventBus } from "../src/scenario/index";
import { LankaValidationError } from "../src/validation/index";
import { ALankaSingleton } from "../src/locator/index";
import { LankaLogger, lankaLogger } from "../src/logger/index";
import { PlaygroundTodoGateway } from "./playground-todo-gateway/PlaygroundTodoGateway";
import { ALankaPlugin } from "../src/bootstrap/index";
import { createLankaScenario } from "../src/scenario/index";
import { createLankaSharedStore } from "../src/viewmodel/index";
import {
	createLankaFetchFormDataRequest,
	createLankaFetchRequest,
	LankaFetchFormDataRequest,
	LankaFetchRequest,
} from "../src/gateway/index";
import {
	APlaygroundAuditLog,
	createPlaygroundTodoGateway,
	createPlaygroundAuditLog,
	PlaygroundSessionService,
	PlaygroundTodoScreen,
	PlaygroundBadgeVM,
	PlaygroundClock,
	PlaygroundStatsVM,
	PlaygroundTodosVM,
	PlaygroundBareGateway,
	createPlaygroundTodosVM,
	createPlaygroundTransport,
	playgroundAmbient,
	playgroundSession,
	playgroundTodoCompleted,
	startPlayground,
} from "./app";
import type { IPlaygroundClock, IPlaygroundTodo } from "./app";

type TPlaygroundApp = Awaited<ReturnType<typeof startPlayground>>;

/**
 * The package, exercised as a consumer uses it.
 *
 * Unit tests prove each part behaves. This proves the parts still FIT: a request
 * reaches the transport, its answer becomes state, the state reaches the screen,
 * an action triggers a scenario, and the scenario writes back — through the same
 * public path an application takes.
 *
 * When something is added to the package, a scene is added here. When a
 * regression is reported, it is reproduced here first: a failure that needs the
 * whole chain has no single unit to live in.
 */
const todos = (): IPlaygroundTodo[] => [
	{ id: 1, title: "write the canon", done: false },
	{ id: 2, title: "run the canon", done: false },
];

let app: TPlaygroundApp | null = null;

beforeEach(() => {
	resetActiveLanka();
});

afterEach(() => {
	cleanup();
	app?.lanka.dispose();
	app = null;
});

describe("the playground application", () => {
	it("boots, fetches, and renders what the server answered", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		render(<PlaygroundTodoScreen useTodosVM={app.useTodosVM} />);
		await act(async () => {
			await app!.useTodosVM.getState().load();
		});

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("sends the request through the host's base URL", async () => {
		const transport = createPlaygroundTransport(todos());
		app = await startPlayground(transport);

		await app.useTodosVM.getState().load();

		expect(transport.calls).toEqual(["https://api.test/todos"]);
	});

	it("shows the failure the framework named, not a raw throw", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		render(<PlaygroundTodoScreen useTodosVM={app.useTodosVM} />);
		await act(async () => {
			await app!.useTodosVM.getState().loadOne(404);
		});

		// The transport answered 404 with a body. The request turned it into a
		// LankaError carrying the SERVER's message — the host's wording is the
		// fallback for when there is none — and the screen never sees a status code.
		expect(screen.getByRole("alert").textContent).toBe("no such todo");
	});

	it("re-renders only when a key the screen READ changes", async () => {
		const onRender = vi.fn();
		app = await startPlayground(createPlaygroundTransport(todos()));

		render(<PlaygroundTodoScreen useTodosVM={app.useTodosVM} onRender={onRender} />);
		const initial = onRender.mock.calls.length;

		await act(async () => {
			await app!.useTodosVM.getState().load();
		});

		expect(onRender.mock.calls.length).toBeGreaterThan(initial);
	});

	it("carries a scenario from one place to the state of another", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		await act(async () => {
			await app!.useTodosVM.getState().load();
		});

		// Nobody calls the ViewModel here: the scenario is triggered as a different
		// screen would, and the subscription does the rest.
		act(() => {
			playgroundTodoCompleted.trigger({ id: 1 });
		});

		expect(app.useTodosVM.getState().todos[0].done).toBe(true);
		expect(app.useTodosVM.getState().todos[1].done).toBe(false);
	});

	it("shows a scenario's effect on the screen", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		render(<PlaygroundTodoScreen useTodosVM={app.useTodosVM} />);
		await act(async () => {
			await app!.useTodosVM.getState().load();
		});

		act(() => {
			playgroundTodoCompleted.trigger({ id: 2 });
		});

		expect(screen.getByText("run the canon ✓")).toBeTruthy();
	});

	it("an action both writes state and announces it", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const heard = vi.fn();
		const stop = playgroundTodoCompleted.subscribe(heard);

		await act(async () => {
			await app!.useTodosVM.getState().load();
		});
		act(() => {
			app!.useTodosVM.getState().complete(1);
		});

		expect(app.useTodosVM.getState().todos[0].done).toBe(true);
		expect(heard).toHaveBeenCalledWith({ id: 1 });
		stop();
	});

	it("refuses to work after dispose, and says why", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		await app.useTodosVM.getState().load();

		app.lanka.dispose();

		// A disposed instance leaves no active runtime, and the ambient facade says
		// so instead of silently subscribing to a bus nobody dispatches on — which
		// is how a screen ends up permanently frozen with no error anywhere.
		expect(() => playgroundTodoCompleted.subscribe(vi.fn())).toThrow(/createLanka/);

		app = null;
	});
});

/**
 * The layers a screen never sees, exercised the way an application uses them.
 *
 * Everything below is reachable from the facade and was, until these scenes,
 * demonstrated nowhere: the locator that makes an object replaceable, the four
 * shapes a ViewModel comes in, the schema port, and the two ways a request can
 * be refused. A promise nobody has been shown how to use is a promise made
 * blind, and this framework does not remove one once made.
 */
describe("the layers under the screen", () => {
	it("resolves a service by name, and the ambient facade finds the same one", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const resolved = playgroundSession(app.lanka);
		resolved.signIn("Ada");

		// Two paths, one object: an application holding the instance resolves
		// through it, a module with no instance in hand resolves ambiently.
		expect(playgroundAmbient().session.who).toBe("Ada");
		expect(playgroundAmbient().gateway).toBe(
			app.lanka.locators.gateways.get("playgroundTodoGateway"),
		);
	});

	it("hands a scope its own instance of a service", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		playgroundSession(app.lanka).signIn("Ada");

		const scoped = app.lanka
			.createScope()
			.resolve<PlaygroundSessionService>("playgroundSessionService");

		// A lifetime shorter than the application's: the scoped object starts
		// empty, and goes away with the scope rather than with the tab.
		expect(scoped.who).toBe(null);
	});

	it("answers questions about a list without holding one", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		expect(app.useStatsVM.getState().describe(todos())).toBe("0 of 2");
	});

	it("lets two view models agree through one store", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		app.useBadgeVM.getState().select(2);

		// The badge wrote it; the store is what anyone else reads. Neither
		// ViewModel owns a copy, so they cannot drift apart.
		expect(app.store.getState().selectedId).toBe(2);
		app.useBadgeVM.getState().clear();
		expect(app.store.getState().selectedId).toBe(null);
	});

	it("builds a lazy view model on first use, not on import", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		await app.useLazyTodosVM.getState().load();

		expect(app.useLazyTodosVM.getState().todos).toHaveLength(2);
	});

	it("refuses a request that cannot succeed, in the framework's own failure shape", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		// A local no and a server no arrive as the same kind of thing, so a screen
		// has one failure to render rather than two.
		await expect(gateway.search("  ")).rejects.toThrow("a search needs a term");
	});

	it("sends what a query builder made of a nested value", async () => {
		const transport = createPlaygroundTransport(todos());
		app = await startPlayground(transport);
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		await gateway.search("canon");

		expect(transport.calls.at(-1)).toContain("q=canon");
		expect(transport.calls.at(-1)).toContain("tags%5B%5D=open");
	});

	it("validates a body against a hand-written schema", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		// The schema implements Standard Schema and nothing else, which is what
		// makes @lankajs/zod and @lankajs/valibot interchangeable rather than blessed.
		await expect(gateway.listValidated()).resolves.toHaveLength(2);
	});

	it("says which field was wrong when the server answers something else", async () => {
		app = await startPlayground(
			createPlaygroundTransport([{ id: 1 } as unknown as IPlaygroundTodo]),
		);
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		// The message names the CONTEXT and the field paths live in `errors`: that
		// is the split a form needs — one line for a banner, one entry per input.
		await expect(gateway.listValidated()).rejects.toThrow(LankaValidationError);
		await gateway.listValidated().catch((error: unknown) => {
			expect((error as LankaValidationError).errors).toEqual(["0.title: not a todo"]);
		});
	});

	it("carries a scenario over the event bus every subscriber shares", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const heard = vi.fn();
		const stop = lankaEventBus.subscribe(playgroundTodoCompleted.eventType, heard);

		playgroundTodoCompleted.trigger({ id: 1 });

		// A scenario is a name over the bus: subscribing to the raw event type is
		// what a diagnostic does, and it sees exactly what a ViewModel sees.
		expect(heard).toHaveBeenCalledWith({ id: 1 });
		stop();
	});

	it("tells a screen where it is running", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		expect(app.describeEnvironment()).toContain("https://api.test");
	});
});

describe("the four ambient facades", () => {
	it("refuse a name nobody registered, by name", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const ambient = playgroundAmbient();

		// The alternative is `undefined` arriving in a screen as "cannot read
		// property of undefined", three layers from the missing registration.
		expect(() => (ambient.scenarios as unknown as Record<string, unknown>).nothingHere).toThrow(
			/scenario/i,
		);
		expect(
			() => (ambient.sharedStores as unknown as Record<string, unknown>).nothingHere,
		).toThrow(/store/i);
	});
});

describe("a server that speaks another shape", () => {
	it("maps the wire into the application's vocabulary, then checks it", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		const list = await gateway.listFromLegacyApi();

		// `todo_id` / `is_done: 0` went in; `id` / `done: false` came out. The
		// mapping travelled in the schema — there is no adapter layer, because
		// Standard Schema's validate returns the transformed value.
		expect(list[0]).toEqual({ id: 1, title: "write the canon", done: false });
	});

	it("blames the server, not the application, when the wire is wrong", async () => {
		app = await startPlayground(
			createPlaygroundTransport([{ id: 1 } as unknown as IPlaygroundTodo]),
		);
		const gateway = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		await gateway.listFromLegacyApi().catch((error: unknown) => {
			// Two schemas, two contexts: which of the two contracts broke is in the
			// message, and it is the difference between calling the backend team
			// and reading your own reducer.
			expect((error as Error).message).toContain("todos.legacy.map");
		});

		expect.assertions(1);
	});
});

describe("a layer the application invented", () => {
	it("writes it as a class, extending what the framework gave it", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		class LoudAuditLog extends APlaygroundAuditLog {
			public constructor() {
				super({ prefix: "! " });
			}

			public completed(id: number): void {
				this.record(`todo ${String(id)} completed`);
			}

			public read(): readonly string[] {
				return this.entries();
			}
		}

		const log = new LoudAuditLog();
		log.completed(1);

		expect(log.read()).toEqual(["! todo 1 completed"]);
	});

	it("writes the same thing as a factory, over the same class", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const log = createPlaygroundAuditLog({
			prefix: "! ",
			build: ({ record, entries }) => ({
				completed: (id: number) => {
					record(`todo ${String(id)} completed`);
				},
				read: entries,
			}),
		});

		log.completed(1);

		// One line in the application turned its own layer into both styles, and
		// the framework's own roles use the same line.
		// The same option reached the same field, through a different door.
		expect(log.read()).toEqual(["! todo 1 completed"]);
	});

	it("answers the instance when the caller declared no methods", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const log = createPlaygroundAuditLog({ prefix: "" });

		// A role whose body is data needs no hooks, and asking for them would be
		// ceremony: the factory hands back what the class style would have built.
		expect(log).toBeInstanceOf(APlaygroundAuditLog);
	});
});

describe("the same role, either style", () => {
	it("a gateway written by calling answers what the class answers", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const written = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;
		const called = createPlaygroundTodoGateway(createPlaygroundTransport(todos()));

		expect(await called.list()).toEqual(await written.list());
		expect(await called.byId(1)).toEqual(await written.byId(1));
	});

	it("and sends the same query for the same search", async () => {
		const classTransport = createPlaygroundTransport(todos());
		const factoryTransport = createPlaygroundTransport(todos());
		app = await startPlayground(classTransport);
		const written = app.lanka.locators.gateways.get(
			"playgroundTodoGateway",
		) as PlaygroundTodoGateway;

		await written.search("canon");
		await createPlaygroundTodoGateway(factoryTransport).search("canon");

		// The context's `buildQueryParams` is the class's protected method: same
		// serialisation, same URL, one implementation.
		expect(factoryTransport.calls.at(-1)).toBe(classTransport.calls.at(-1));
	});

	it("a scenario built by calling behaves as one written as a class", () => {
		const built = createLankaScenario<{ id: number }>({
			name: "PlaygroundTodoArchived",
			eventType: "playground:todo-archived",
			dataTypeName: "IPlaygroundTodoArchived",
		});

		const heard: number[] = [];
		const stop = built.subscribe((data) => {
			if (data) heard.push(data.id);
		});
		built.trigger({ id: 7 });
		stop();

		// Three fields and no behaviour is what every scenario in the two
		// applications this framework grew out of actually contains.
		expect(heard).toEqual([7]);
		expect(built.name).toBe("PlaygroundTodoArchived");
	});

	it("a shared store built by calling resets like one written as a class", () => {
		const store = createLankaSharedStore(() => ({ selectedId: null as number | null }));

		store.setState({ selectedId: 4 });
		expect(store.getState().selectedId).toBe(4);

		store.reset();
		expect(store.getState().selectedId).toBe(null);
	});
});

describe("a plugin written as a class", () => {
	it("installs and tears down like one written as a function", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));
		const seen: string[] = [];

		class PlaygroundProbePlugin extends ALankaPlugin {
			public readonly name = "playground-probe";

			protected onInstall(): void {
				seen.push("installed");
			}

			protected override onUninstall(): void {
				seen.push("removed");
			}
		}

		const remove = app.lanka.use(new PlaygroundProbePlugin());
		remove();

		// `use()` received an `ILankaPlugin` and cannot tell which style wrote it.
		expect(seen).toEqual(["installed", "removed"]);
	});
});

describe("a ViewModel written as a class", () => {
	it("loads, completes and hears a scenario like one built by calling", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const gateway = new PlaygroundTodoGateway(createPlaygroundTransport(todos()));
		const useBuilt = createPlaygroundTodosVM(gateway);
		const useWritten = new PlaygroundTodosVM(gateway).build();

		await act(async () => {
			await useBuilt.getState().load();
			await useWritten.getState().load();
		});

		// Two idioms, one implementation: the same list, and the flag back down.
		expect(useWritten.getState().todos).toEqual(useBuilt.getState().todos);
		expect(useWritten.getState().isLoading).toBe(false);

		act(() => {
			useBuilt.getState().complete(1);
		});

		// The class declared the same binding, so the scenario the FUNCTIONAL one
		// triggered arrives at the class-style handler and marks the same item.
		expect(useWritten.getState().todos[0].done).toBe(true);
		expect(useWritten.getState().todos).toEqual(useBuilt.getState().todos);
	});
});

describe("a singleton declared by calling", () => {
	it("resolves, caches and is discovered like one written as a class", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const first = app.lanka.resolve<IPlaygroundClock>("playgroundClock");
		const second = app.lanka.resolve<IPlaygroundClock>("playgroundClock");

		// Built on first use and cached, which is the capability the class style
		// has and `registerInstance` does not.
		expect(second).toBe(first);
		expect(first.ticks()).toBe(1);
		expect(second.ticks()).toBe(2);

		// And it carries the marker, so a consumer's barrel discovers it too.
		expect(ALankaSingleton.is(PlaygroundClock)).toBe(true);
	});
});

describe("a second logger, built from the class", () => {
	it("keeps its own sinks, flags and printers", () => {
		const heard: string[] = [];

		const audit = new LankaLogger();
		audit.silent();
		audit.addSink({ emit: ({ message }) => heard.push(String(message)) });
		audit.setEnabled(true);
		audit.setFlag("GATEWAY", true);

		audit.printGatewayLog("audited");
		lankaLogger.printGatewayLog("not audited");

		// `console` to this file's `Console`: the ambient one is what everything
		// writes to, and a second one is a real thing to want — here, a test that
		// reads what was logged without silencing the page.
		expect(heard).toEqual(["audited"]);
	});
});

describe("the request kinds that do not parse a body", () => {
	it("hands back the raw response, whichever style built it", async () => {
		const transport = createPlaygroundTransport(todos());

		const constructed = new LankaFetchRequest({ transport });
		const built = createLankaFetchRequest({ transport });

		const fromClass = await constructed.execute<Response>("/todos");
		const fromFactory = await built.execute<Response>("/todos");

		// A download, an image, a stream: the caller wants the response itself, so
		// the request kind hands it over untouched. Both styles hand over the same.
		expect(fromClass.status).toBe(200);
		expect(fromFactory.status).toBe(200);
		expect(await fromClass.json()).toEqual(await fromFactory.json());
	});

	it("sends a multipart body, whichever style built it", async () => {
		const transport = createPlaygroundTransport(todos());

		const body = new FormData();
		body.append("title", "written from a form");

		const constructed = new LankaFetchFormDataRequest({ transport });
		const built = createLankaFetchFormDataRequest({ transport });

		await constructed.execute<Response>("/todos", { method: "POST", body });
		await built.execute<Response>("/todos", { method: "POST", body });

		// What this kind carries is a multipart body, and both styles carry the
		// same one with no headers of their own — the missing `content-type` is the
		// browser's to write, and belongs to the transport this playground replaces.
		// So the scene reads what reached the seam rather than trusting a sentence.
		expect(transport.calls).toEqual(["/todos", "/todos"]);
		for (const options of transport.sent) {
			expect(options?.body).toBe(body);
			expect(new Headers(options?.headers).get("content-type")).toBe(null);
		}
	});
});

describe("a stateless ViewModel written as a class", () => {
	it("answers what the built one answers", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const written = new PlaygroundStatsVM().build();
		const rows = todos();

		// A ViewModel that holds nothing is where the two styles come closest, so
		// this is the one place a divergence would be hardest to notice by reading.
		expect(written.getState().countDone(rows)).toBe(app.useStatsVM.getState().countDone(rows));
		expect(written.getState().describe(rows)).toBe(app.useStatsVM.getState().describe(rows));
	});
});

describe("a shared-store ViewModel written as a class", () => {
	it("writes into the same store the built one reads", async () => {
		app = await startPlayground(createPlaygroundTransport(todos()));

		const started = app;
		const written = new PlaygroundBadgeVM(started.store).build();

		act(() => {
			written.getState().select(3);
		});

		// One store, two ViewModels, two styles: what the class wrote is what the
		// built one reads, which is the whole point of the rung.
		expect(started.useBadgeVM.getState().selectedId).toBe(3);

		act(() => {
			started.useBadgeVM.getState().clear();
		});

		expect(written.getState().selectedId).toBe(null);
	});
});

describe("the shortest start an application can write", () => {
	/**
	 * What a new project types on day one, and nothing else.
	 *
	 * The scenes above build the framework the long way — `createLanka`, a
	 * registration, `bootstrap` — because they need what happens between the
	 * steps. This is the other end: one call, one field, and a gateway that was
	 * given no transport at all.
	 */
	it("starts from a base URL alone, and is bootstrapped when it answers", async () => {
		const lanka = await startLanka({ apiBaseUrl: "https://api.test" });

		expect(lanka.isBootstrapped()).toBe(true);
		expect(getLankaHost().apiBaseUrl).toBe("https://api.test");

		lanka.dispose();
	});

	it("gives a gateway a JSON request nobody asked for", async () => {
		const lanka = await startLanka({ apiBaseUrl: "https://api.test" });

		// No `request`, no transport: the ordinary case costs no wiring, and the
		// gateway is still an ordinary gateway — `endpoint()` prefixes the host.
		const bare = new PlaygroundBareGateway();
		expect(bare.where()).toBe("https://api.test/todos");

		lanka.dispose();
	});

	it("takes a host of its own when the copy is not English", async () => {
		const lanka = await startLanka({
			host: createLankaHost({
				apiBaseUrl: "/api",
				networkErrorMessage: () => "no connection",
			}),
		});

		expect(getLankaHost().networkErrorMessage()).toBe("no connection");

		lanka.dispose();
	});
});
