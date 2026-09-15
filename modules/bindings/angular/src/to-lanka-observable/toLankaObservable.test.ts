import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncPipe } from "@angular/common";
import { Component, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { toLankaObservable } from "./toLankaObservable";

/**
 * The half of Angular that speaks RxJS, and the two rules that keep it a
 * spelling.
 *
 * It has to satisfy the contract Angular's own `AsyncPipe` reads — which is the
 * only definition of "works with `| async`" that is not a guess — and it has to
 * be the same subscription over the same store, with the same skips.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

const titles = (): readonly string[] => ["write the canon", "run the canon"];

describe("the stream contract, as Angular reads one", () => {
	it("emits the CURRENT state first, like a BehaviorSubject", () => {
		// A template rendering `| async` would otherwise show nothing until the
		// first write, which is not what any store an Angular consumer has met
		// does.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];

		const subscription = toLankaObservable(todosVM).subscribe((state) =>
			seen.push(state.rows.length),
		);

		expect(seen).toEqual([0]);
		subscription.unsubscribe();
	});

	it("takes an observer object as well as a function", () => {
		// RxJS accepts both, and a consumer piping this into anything will hand it
		// the object form.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const next = vi.fn();

		const subscription = toLankaObservable(todosVM).subscribe({ next });

		expect(next).toHaveBeenCalledTimes(1);
		subscription.unsubscribe();
	});

	it("survives an observer with no `next` at all", () => {
		// The contract allows one. A binding that assumed `next` would throw inside
		// the caller's subscribe rather than do nothing.
		const todosVM = createLankaFakeVM({ rows: titles() });

		const subscription = toLankaObservable(todosVM).subscribe({});
		todosVM.getState().touchUnread();

		expect(() => subscription.unsubscribe()).not.toThrow();
	});

	it("emits again when a key the subscriber read has moved", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const subscription = toLankaObservable(todosVM).subscribe((state) =>
			seen.push(state.rows.length),
		);

		await todosVM.getState().load();

		expect(seen.at(-1)).toBe(2);
		subscription.unsubscribe();
	});

	it("does NOT emit for a key the subscriber never read", () => {
		// Access tracking, through the stream spelling: a subscriber that reads
		// only `rows` is not woken by `unread`.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const subscription = toLankaObservable(todosVM).subscribe((state) => {
			void state.rows;
			seen.push(1);
		});
		const before = seen.length;

		todosVM.getState().touchUnread();

		expect(seen).toHaveLength(before);
		subscription.unsubscribe();
	});

	it("stops emitting once unsubscribed", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const seen: number[] = [];
		const subscription = toLankaObservable(todosVM).subscribe((state) =>
			seen.push(state.rows.length),
		);

		subscription.unsubscribe();
		await todosVM.getState().load();

		expect(seen).toEqual([0]);
	});

	it("gives each subscriber its own recording", () => {
		// Two readers of one ViewModel read different keys and must be woken for
		// different changes — the same rule every binding on the shelf follows.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const rowsReader: number[] = [];
		const unreadReader: number[] = [];
		const first = toLankaObservable(todosVM).subscribe((state) => {
			void state.rows;
			rowsReader.push(1);
		});
		const second = toLankaObservable(todosVM).subscribe((state) => {
			void state.unread;
			unreadReader.push(1);
		});

		todosVM.getState().touchUnread();

		expect(rowsReader).toHaveLength(1);
		expect(unreadReader).toHaveLength(2);
		first.unsubscribe();
		second.unsubscribe();
	});

	it("needs no injection context, unlike the signal spellings", () => {
		// A stream's subscriber holds its own unsubscribe, which is RxJS's answer
		// to the question `DestroyRef` answers for a signal — so this works in a
		// service, a resolver, an interceptor and a plain function.
		const todosVM = createLankaFakeVM({ rows: titles() });

		expect(() =>
			toLankaObservable(todosVM)
				.subscribe(() => undefined)
				.unsubscribe(),
		).not.toThrow();
	});
});

describe("through Angular's own `async` pipe", () => {
	it("renders what the ViewModel holds", async () => {
		// The only definition of "works with `| async`" that is not a guess: the
		// pipe itself accepts it.
		const todosVM = createLankaFakeVM({ rows: titles() });

		@Component({
			template: "{{ (todos$ | async)?.rows?.length }}",
			standalone: true,
			imports: [AsyncPipe],
		})
		class TodoScreen {
			protected readonly todos$ = toLankaObservable(todosVM);
		}

		const screen = TestBed.createComponent(TodoScreen);
		screen.detectChanges();
		await todosVM.getState().load();
		screen.detectChanges();

		expect(screen.nativeElement.textContent).toContain("2");
	});
});
