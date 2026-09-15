---
"@lankajs/angular": minor
---

`@lankajs/angular` — the same ViewModel, read from an Angular component.

```ts
@Component({ template: `<li *ngFor="let row of state().rows">{{ row }}</li>` })
export class TodoScreen {
	protected readonly state = useLankaVM(todoVM);
}
```

It answers a `Signal`, and zoneless needs no extra step — a signal is what
zoneless change detection reads.

It is the one binding that REFUSES a call made outside its framework's scope
rather than degrading. Vue's and Solid's publish a `stop()` for that case because
both can still work without one; Angular cannot, because `DestroyRef` is the only
way to learn the caller has gone. A refusal read once beats a leak found in
production.
