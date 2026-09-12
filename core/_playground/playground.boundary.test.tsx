import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resetActiveLanka } from "../src/bootstrap/index";
import {
	applyPlaygroundOutcome,
	createPlaygroundForm,
	createPlaygroundOrderTransport,
	playgroundOrderInputSchema,
	playgroundOrderUpdated,
	PlaygroundFormikScreen,
	PlaygroundHookFormScreen,
	PlaygroundReactQueryScreen,
	PlaygroundReadCache,
	PlaygroundRenameScreen,
	PlaygroundSwrScreen,
	PlaygroundTanstackFormScreen,
	PlaygroundTanstackReadCache,
	startOrderPlayground,
} from "./app";
import type {
	IPlaygroundOrder,
	IPlaygroundOrderApp,
	IPlaygroundOrderInput,
	TPlaygroundReadCacheClass,
} from "./app";

/**
 * The boundary between a ViewModel, a form and a read cache — run, not argued.
 *
 * Four configurations of one application: lanka alone, lanka under a form,
 * lanka over a cache, and all three. The seams are proved twice each: once over
 * stand-ins kept to the exact shape of the seam — a `Map` for the cache, an
 * object for the form — and once over the libraries an application actually
 * brings: TanStack Query under the ViewModels, React Hook Form, TanStack Form
 * and Formik above them, React Query and SWR in a component of their own.
 *
 * Two rules recur in every group. A scenario begins in a ViewModel action and
 * ends in a ViewModel handler — a form never hears one, a cache event never
 * raises one. And nothing that arrives from elsewhere ever touches what a person
 * is typing: the server's version is marked, the inputs are left alone.
 */
const orders = (): IPlaygroundOrder[] => [
	{
		id: 1,
		customer: "Ann",
		items: [
			{ sku: "pen", qty: 1 },
			{ sku: "ink", qty: 1 },
		],
		updatedAt: 1,
	},
	{ id: 2, customer: "Bob", items: [{ sku: "pen", qty: 3 }], updatedAt: 1 },
];

const stock = { pen: 10, ink: 2 };

const inputOf = (order: IPlaygroundOrder): IPlaygroundOrderInput => ({
	customer: order.customer,
	items: order.items,
});

/** The server's version as a ViewModel holds it NOW — a state snapshot goes stale. */
const serverOf = (hook: { getState: () => { server: IPlaygroundOrder | null } }) => {
	const server = hook.getState().server;
	if (!server) throw new Error("nothing is loaded");
	return server;
};

// The transport records `METHOD url`, and the url carries the test host's base.
const calls = (log: string[], method: string, path: string) =>
	log.filter((call) => call.startsWith(`${method} `) && call.endsWith(path));

const neverLoads = () => vi.fn(() => Promise.reject(new Error("must be answered from memory")));

const caches: [string, TPlaygroundReadCacheClass][] = [
	["a Map", PlaygroundReadCache],
	["TanStack Query", PlaygroundTanstackReadCache],
];

let app: IPlaygroundOrderApp | null = null;

beforeEach(() => {
	resetActiveLanka();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	app?.lanka.dispose();
	app = null;
});

describe("only lanka — the inputs live in the ViewModel", () => {
	it("re-renders the input that changed and not its neighbour", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const onCustomerRender = vi.fn();
		const onNoteRender = vi.fn();

		render(
			<PlaygroundRenameScreen
				useRenameVM={app.useRenameVM}
				onCustomerRender={onCustomerRender}
				onNoteRender={onNoteRender}
			/>,
		);
		const customerBefore = onCustomerRender.mock.calls.length;
		const noteBefore = onNoteRender.mock.calls.length;

		act(() => {
			app!.useRenameVM.getState().setCustomer("Al");
		});

		// Flat keys: `customer` moved, `note` did not, and only the reader of
		// `customer` paid. One `values` object would have charged both.
		expect(onCustomerRender.mock.calls.length).toBe(customerBefore + 1);
		expect(onNoteRender.mock.calls.length).toBe(noteBefore);
	});

	it("refuses an empty input from the schema, at its address, before any request", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useRenameVM.getState();

		await vm.load(1);
		vm.setCustomer("   ");
		await vm.submit();

		expect(app.useRenameVM.getState().fieldErrors).toEqual([
			{ path: ["customer"], message: "a customer is required" },
		]);
		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(0);
	});

	it("places a 422 on its input and keeps the screen quiet", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useRenameVM.getState();

		await vm.load(1);
		vm.setCustomer("duplicate");
		await vm.submit();

		const state = app.useRenameVM.getState();
		expect(state.fieldErrors).toEqual([
			{ path: ["customer"], message: "that name is already used" },
		]);
		expect(state.screenError).toBeNull();
		expect(state.customer).toBe("duplicate");
	});

	it("sends a network failure to the screen and leaves the inputs alone", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useRenameVM.getState();

		await vm.load(1);
		vm.setCustomer("Ann B");
		transport.failNext("network");
		await vm.submit();

		const state = app.useRenameVM.getState();
		expect(state.screenError).not.toBeNull();
		expect(state.fieldErrors).toEqual([]);
		expect(state.customer).toBe("Ann B");
	});

	it("announces its own save with the data, and a subscriber applies it without asking the server", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const rename = app.useRenameVM.getState();
		const edit = app.useEditVM.getState();

		await rename.load(1);
		await edit.load(1);
		const getsBefore = calls(transport.calls, "GET", "/orders/1").length;

		rename.setCustomer("Ann B");
		await rename.submit();

		// The edit screen heard the fact and took the version from the payload —
		// no request of its own.
		expect(app.useEditVM.getState().server?.customer).toBe("Ann B");
		expect(app.useEditVM.getState().serverChangedAt).toBe(2);
		expect(calls(transport.calls, "GET", "/orders/1")).toHaveLength(getsBefore);
		// And its own handler stayed quiet: the marker was written before the announcement.
		expect(app.useRenameVM.getState().serverChangedAt).toBeNull();
	});

	it("hears another screen's save without touching what is being typed", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useRenameVM.getState();

		await vm.load(1);
		vm.setCustomer("typing…");
		const elsewhere: IPlaygroundOrder = { ...orders()[0], customer: "Someone", updatedAt: 7 };

		playgroundOrderUpdated.trigger({ order: elsewhere });

		const state = app.useRenameVM.getState();
		expect(state.serverChangedAt).toBe(7);
		expect(state.customer).toBe("typing…");
	});
});

describe("lanka and a form — the form owns the inputs", () => {
	it("saves: validated by the shared schema, announced with its data, the form told last", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);

		// The resolver IS the schema the gateway checks the payload with.
		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);
		form.setValues({ customer: "Ann B" });
		expect(form.isDirty).toBe(true);

		await form.handleSubmit(async (values) => {
			applyPlaygroundOutcome(form, await vm.submit(values));
		});

		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(1);
		expect(app.useEditVM.getState().server?.customer).toBe("Ann B");
		expect(form.errors.size).toBe(0);
		expect(form.isDirty).toBe(false);
	});

	it("lands a 422 on the second line's quantity, and the server's version is untouched", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);

		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);
		form.setValues({
			items: [
				{ sku: "pen", qty: 1 },
				{ sku: "ink", qty: 5 },
			],
		});

		await form.handleSubmit(async (values) => {
			applyPlaygroundOutcome(form, await vm.submit(values));
		});

		// Segments from the server body, joined the way THIS form spells them.
		expect(form.errors.get("items.1.qty")).toBe("only 2 left");
		expect(form.values.items[1]?.qty).toBe(5);
		expect(app.useEditVM.getState().server?.updatedAt).toBe(1);
		expect(app.useEditVM.getState().screenError).toBeNull();
	});

	it("keeps an invalid input inside the form: no request is made", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);

		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);
		form.setValues({ customer: "" });
		const submit = vi.fn(vm.submit);

		await form.handleSubmit(async (values) => {
			applyPlaygroundOutcome(form, await submit(values));
		});

		expect(form.errors.get("customer")).toBe("a customer is required");
		expect(submit).not.toHaveBeenCalled();
		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(0);
	});

	it("gives a stale save to the screen, not to the form", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);
		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);

		// Somebody saved on the server while this form was open.
		transport.orders[0] = { ...transport.orders[0], updatedAt: 5 };
		form.setValues({ customer: "Ann B" });
		await form.handleSubmit(async (values) => {
			applyPlaygroundOutcome(form, await vm.submit(values));
		});

		expect(app.useEditVM.getState().screenError).toBe("someone saved this order first");
		expect(form.errors.size).toBe(0);
		expect(form.values.customer).toBe("Ann B");
	});

	it("runs an input's asynchronous check through the ViewModel", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);
		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);

		form.setValues({ customer: "Zed" });
		await form.validateField("customer", (values) => vm.checkCustomer(values.customer));
		expect(form.errors.get("customer")).toBe("unknown customer");

		form.setValues({ customer: "Bob" });
		await form.validateField("customer", (values) => vm.checkCustomer(values.customer));
		expect(form.errors.has("customer")).toBe(false);

		// The request was the gateway's, called from the ViewModel — the form
		// only asked a question.
		expect(calls(transport.calls, "GET", "/orders/customers/Zed")).toHaveLength(1);
	});

	it("marks another screen's save and leaves the form alone", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);
		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);
		form.setValues({ customer: "typing…" });
		const valuesBefore = form.values;

		const elsewhere: IPlaygroundOrder = { ...orders()[0], customer: "Someone", updatedAt: 7 };
		playgroundOrderUpdated.trigger({ order: elsewhere });

		const state = app.useEditVM.getState();
		expect(state.server).toBe(elsewhere);
		expect(state.serverChangedAt).toBe(7);
		expect(form.values).toBe(valuesBefore);
		expect(form.errors.size).toBe(0);
	});

	it("shows nothing anywhere for a cancelled save", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);
		const form = createPlaygroundForm(
			playgroundOrderInputSchema,
			inputOf(serverOf(app.useEditVM)),
		);
		const controller = new AbortController();
		controller.abort();

		const outcome = await vm.submit(form.values, { signal: controller.signal });
		applyPlaygroundOutcome(form, outcome);

		expect(outcome).toEqual({ ok: false, fields: [] });
		expect(app.useEditVM.getState().screenError).toBeNull();
		expect(form.errors.size).toBe(0);
	});

	it("carries the server's reason beside its message, for an application that translates", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);

		const outcome = await vm.submit({
			...inputOf(serverOf(app.useEditVM)),
			items: [
				{ sku: "pen", qty: 1 },
				{ sku: "ink", qty: 9 },
			],
		});

		expect(outcome).toEqual({
			ok: false,
			fields: [{ path: ["items", 1, "qty"], message: "only 2 left", code: "STOCK" }],
		});
	});

	it("reads its own announcement as nothing new", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		const vm = app.useEditVM.getState();
		await vm.load(1);

		const outcome = await vm.submit({ ...inputOf(serverOf(app.useEditVM)), customer: "Ann B" });

		expect(outcome.ok).toBe(true);
		expect(app.useEditVM.getState().serverChangedAt).toBeNull();
	});
});

describe.each(caches)(
	"lanka and a read cache over %s — a service under the ViewModel",
	(_, Cache) => {
		const start = (transport: ReturnType<typeof createPlaygroundOrderTransport>) =>
			startOrderPlayground(transport, { cache: Cache });

		it("two screens reading one resource cost one request and share the answer", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);

			await Promise.all([
				app.useOrdersVM.getState().load(),
				app.useSecondOrdersVM.getState().load(),
			]);

			expect(calls(transport.calls, "GET", "/orders")).toHaveLength(1);
			expect(app.useOrdersVM.getState().orders).toBe(app.useSecondOrdersVM.getState().orders);
			expect(app.useOrdersVM.getState().orders.map((order) => order.customer)).toEqual([
				"Ann",
				"Bob",
			]);
		});

		it("serves a fresh answer from memory", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const vm = app.useOrdersVM.getState();

			await vm.load();
			await vm.load();

			expect(calls(transport.calls, "GET", "/orders")).toHaveLength(1);
		});

		it("hears a change made elsewhere through the cache — no scenario involved", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			await app.useOrdersVM.getState().load();
			const renamed = orders().map((order) =>
				order.id === 2 ? { ...order, customer: "Bo" } : order,
			);

			// The list has no scenarioHandlers. Its `onInit` subscribed it, and that
			// hook only runs because bootstrap now registers a ViewModel for its
			// hooks alone.
			app.cache.write(["orders"], renamed);

			expect(app.useOrdersVM.getState().orders.map((order) => order.customer)).toEqual([
				"Ann",
				"Bo",
			]);
			expect(app.useSecondOrdersVM.getState().orders).toBe(app.useOrdersVM.getState().orders);
		});

		it("shows an optimistic rename at once, and takes it back when the server refuses", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const vm = app.useOrdersVM.getState();
			await vm.load();

			const saving = vm.rename(1, "duplicate");
			// Written into the cache before the request, so every reader shows it now.
			expect(app.useOrdersVM.getState().orders[0]?.customer).toBe("duplicate");
			expect(app.useSecondOrdersVM.getState().orders[0]?.customer).toBe("duplicate");

			await saving;

			expect(app.useOrdersVM.getState().orders[0]?.customer).toBe("Ann");
			expect(app.useOrdersVM.getState().screenError).toBe("that name is already used");
		});

		it("keeps an accepted rename, and tells the other screens", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			await app.useOrdersVM.getState().load();
			await app.useEditVM.getState().load(1);

			await app.useOrdersVM.getState().rename(1, "Ann B");

			expect(app.useOrdersVM.getState().orders[0]).toMatchObject({
				customer: "Ann B",
				updatedAt: 2,
			});
			// The edit screen has no cache — it heard the scenario, with the data.
			expect(app.useEditVM.getState().server?.customer).toBe("Ann B");
			expect(calls(transport.calls, "GET", "/orders/1")).toHaveLength(1);
		});

		it("stops hearing and stops asking when a lazy screen is released", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const releases: ReturnType<typeof vi.fn>[] = [];
			const subscribe = app.cache.subscribe.bind(app.cache);
			vi.spyOn(app.cache, "subscribe").mockImplementation((key, onData) => {
				const release = vi.fn(subscribe(key, onData));
				releases.push(release);
				return release;
			});
			const cancel = vi.spyOn(app.cache, "cancel");

			// Built on first access — that is when `onInit` subscribes.
			await app.useLazyOrdersVM.getState().load();
			expect(releases).toHaveLength(1);

			app.useLazyOrdersVM.dispose();

			expect(releases[0]).toHaveBeenCalledOnce();
			expect(cancel).toHaveBeenCalledWith(["orders"]);
		});

		it("never turns a cache event into a scenario", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const trigger = vi.spyOn(playgroundOrderUpdated, "trigger");
			await app.useOrdersVM.getState().load();

			app.cache.write(["orders"], orders());
			await app.cache.invalidate(["orders"]);

			// The bridge runs one way: a save announces AND writes the cache; a cache
			// change announces nothing, or `invalidate → reload → event → announce`
			// would never end.
			expect(trigger).not.toHaveBeenCalled();
		});
	},
);

describe.each(caches)(
	"all three over %s — form above, cache below, the ViewModel between",
	(_, Cache) => {
		const start = (transport: ReturnType<typeof createPlaygroundOrderTransport>) =>
			startOrderPlayground(transport, { cache: Cache });

		it("loads through the cache, edits in the form, and a save reaches everybody in order", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const list = app.useOrdersVM.getState();
			const vm = app.useCachedEditVM.getState();
			await list.load();
			await vm.load(1);
			await vm.load(1);
			expect(calls(transport.calls, "GET", "/orders/1")).toHaveLength(1);

			const form = createPlaygroundForm(
				playgroundOrderInputSchema,
				inputOf(serverOf(app.useCachedEditVM)),
			);
			form.setValues({ customer: "Ann B" });
			const trigger = vi.spyOn(playgroundOrderUpdated, "trigger");

			await form.handleSubmit(async (values) => {
				applyPlaygroundOutcome(form, await vm.submit(values));
			});

			// 1. own write marked  2. announced once  3. detail written, list made
			// stale and reloaded for its reader  4. the form reset with what was saved.
			expect(app.useCachedEditVM.getState().serverChangedAt).toBeNull();
			expect(trigger).toHaveBeenCalledOnce();
			const load = neverLoads();
			await expect(
				app.cache.read(["order", 1], load, { staleMs: 60_000 }),
			).resolves.toMatchObject({ customer: "Ann B", updatedAt: 2 });
			expect(load).not.toHaveBeenCalled();
			expect(calls(transport.calls, "GET", "/orders")).toHaveLength(2);
			expect(app.useOrdersVM.getState().orders[0]?.customer).toBe("Ann B");
			expect(form.isDirty).toBe(false);
		});

		it("marks a version that arrived through the cache and leaves the form alone", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const vm = app.useCachedEditVM.getState();
			await vm.load(1);
			const form = createPlaygroundForm(
				playgroundOrderInputSchema,
				inputOf(serverOf(app.useCachedEditVM)),
			);
			form.setValues({ customer: "typing…" });
			const valuesBefore = form.values;

			const elsewhere: IPlaygroundOrder = {
				...orders()[0],
				customer: "Someone",
				updatedAt: 9,
			};
			app.cache.write(["order", 1], elsewhere);

			const state = app.useCachedEditVM.getState();
			expect(state.server).toMatchObject({ customer: "Someone", updatedAt: 9 });
			expect(state.serverChangedAt).toBe(9);
			expect(form.values).toBe(valuesBefore);
		});

		it("still lands a 422 on the input with a cache underneath", async () => {
			const transport = createPlaygroundOrderTransport(orders(), stock);
			app = await start(transport);
			const vm = app.useCachedEditVM.getState();
			await vm.load(1);
			const form = createPlaygroundForm(
				playgroundOrderInputSchema,
				inputOf(serverOf(app.useCachedEditVM)),
			);
			form.setValues({
				items: [
					{ sku: "pen", qty: 1 },
					{ sku: "ink", qty: 3 },
				],
			});

			await form.handleSubmit(async (values) => {
				applyPlaygroundOutcome(form, await vm.submit(values));
			});

			expect(form.errors.get("items.1.qty")).toBe("only 2 left");
			// The cache was told nothing: a refused save is not a version.
			const load = neverLoads();
			await expect(
				app.cache.read(["order", 1], load, { staleMs: 60_000 }),
			).resolves.toMatchObject({ updatedAt: 1 });
			expect(load).not.toHaveBeenCalled();
		});
	},
);

const formScreens: [string, typeof PlaygroundHookFormScreen][] = [
	["React Hook Form", PlaygroundHookFormScreen],
	["TanStack Form", PlaygroundTanstackFormScreen],
	["Formik", PlaygroundFormikScreen],
];

describe.each(formScreens)("the edit form on %s — the same ViewModel underneath", (_, Screen) => {
	const mount = async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		await app.useEditVM.getState().load(1);
		render(
			<Screen
				initial={inputOf(serverOf(app.useEditVM))}
				submit={app.useEditVM.getState().submit}
			/>,
		);
		return transport;
	};

	it("saves through the ViewModel and shows the saved version", async () => {
		const transport = await mount();

		fireEvent.change(screen.getByLabelText("customer"), { target: { value: "Ann B" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByText("saved v2");
		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(1);
		expect(app!.useEditVM.getState().server?.customer).toBe("Ann B");
	});

	it("places the server's refusal on the second line's quantity", async () => {
		await mount();

		fireEvent.change(screen.getByLabelText("qty 1"), { target: { value: "5" } });
		fireEvent.click(screen.getByText("save"));

		// The ViewModel handed over `["items", 1, "qty"]`; the screen spelled it
		// the way its library does and the message landed on the right line.
		await screen.findByText("only 2 left");
		expect(app!.useEditVM.getState().server?.updatedAt).toBe(1);
		expect(app!.useEditVM.getState().screenError).toBeNull();
	});

	it("keeps an empty input inside the form: the schema refuses before any request", async () => {
		const transport = await mount();

		fireEvent.change(screen.getByLabelText("customer"), { target: { value: "" } });
		fireEvent.click(screen.getByText("save"));

		await screen.findByText("a customer is required");
		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(0);
	});
});

describe("a screen that reads the resource with a query hook of its own", () => {
	it("React Query: the component and the ViewModels share one client", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport, { cache: PlaygroundTanstackReadCache });
		await app.useOrdersVM.getState().load();
		const client = (app.cache as PlaygroundTanstackReadCache).client;

		render(<PlaygroundReactQueryScreen client={client} orderGateway={app.orderGateway} />);

		// Painted from what the ViewModel already loaded: same client, no wait.
		expect(screen.getByText("Ann")).toBeTruthy();

		// A ViewModel's write is this screen's next render.
		act(() => {
			app!.cache.write(
				["orders"],
				orders().map((order) => (order.id === 2 ? { ...order, customer: "Bo" } : order)),
			);
		});
		await screen.findByText("Bo");
	});

	it("SWR: the component reads through its hook, the ViewModel saves, the component asks again", async () => {
		const transport = createPlaygroundOrderTransport(orders(), stock);
		app = await startOrderPlayground(transport);
		await app.useOrdersVM.getState().load();

		render(
			<PlaygroundSwrScreen
				orderGateway={app.orderGateway}
				rename={app.useOrdersVM.getState().rename}
			/>,
		);
		await screen.findByText("Ann");

		fireEvent.click(screen.getByText("rename"));

		await screen.findByText("Ann B");
		expect(calls(transport.calls, "PUT", "/orders/1")).toHaveLength(1);
	});
});
