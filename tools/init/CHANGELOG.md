# @lankajs/tool-init

## 1.0.1

### Patch Changes

- 59879a7: A project scaffolded with TypeBox installs `typebox` — TypeBox 1.x, which
  `@lankajs/typebox@2` binds — and its generated schema file imports from it.
- Updated dependencies [31e8c3c]
    - @lankajs/tool-di@1.2.0

## 1.0.0

### Major Changes

- fb2769d: The first command a project runs: `lanka-init` wires lanka into a project
  somebody else's scaffolder made.

    Eleven templates — the five bindings under Vite, Next, Nuxt, SvelteKit, Expo, a
    browser with no framework and a node service with no screen — and four axes
    beside them: the validator, the transport, the storage engine and sixteen
    extras. Each answer says what it installs, an answer a template cannot run is
    never offered, and a question nobody is there to answer takes the template's own
    default, so the same command works in a terminal and in a script.

    What it writes is the part `create-vite` and `create-next-app` cannot know
    about: the six barrels, the bundler alias in whichever config this project has,
    the `tsconfig` path mapping that a wildcard include silently misses, and one
    feature written through every layer — a gateway, a ViewModel, a scenario and a
    screen — where the screen is the only file that knows which UI framework was
    chosen.

    It never overwrites. A file already there is reported and kept, with the line
    saying what the project must now do itself — which is what makes the second run
    worth having: adding a validator six months later writes exactly one file.

    And it writes no version ranges at all. The names come from the catalog; the
    ranges come from the package manager the project already uses, which is asked to
    add them.
