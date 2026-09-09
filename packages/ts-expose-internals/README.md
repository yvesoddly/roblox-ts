[![License](https://img.shields.io/npm/l/@roblox-ts/ts-expose-internals)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@roblox-ts/ts-expose-internals)](https://www.npmjs.com/package/@roblox-ts/ts-expose-internals)

# TypeScript Internal Types

Expose TypeScript internal types by simply adding a development dependency.

> This is the [roblox-ts](https://github.com/roblox-ts) maintained fork of
> [nonara/ts-expose-internals](https://github.com/nonara/ts-expose-internals), published to npm as
> `@roblox-ts/ts-expose-internals`. It tracks modern TypeScript releases.

## Setup

1. Add aliased dependency to package.json (use the same version as your typescript version)

   ```jsonc
   {
     "devDependencies": {
       "typescript": "^5.9.3",
       // Note: The package is '@roblox-ts/ts-expose-internals', but we are aliasing within the @types scope to make TS adopt it globally
       "@types/ts-expose-internals": "npm:@roblox-ts/ts-expose-internals@5.9.3"
     }
   }
   ```

2. Run `npm install` / `yarn install`

## Usage
All internal types are now available within the primary typescript module
```ts
// This namespace is flagged @internal and is omitted from published types, but now we can access it!
import { JsDoc } from 'typescript'
```

## How It Works

The upstream repository runs the generator on a daily GitHub Actions schedule. Those workflows are not installed by this package import.

It checks for new TypeScript release tags, and if there are any, it clones the source code for that release and
builds the internal types. After, it performs a bit of transformation magic and publishes the package to NPM.

New types are added to the 'typescript' module via the
[Module Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation) technique.

## Notes

- We publish for full TS releases only. If you'd like nightly builds, have a look at [byots](https://github.com/basarat/byots).
- If we don't have a package for the latest release, please allow 24hrs, then file an issue.

## Acknowledgments

Thanks to [nonara](https://github.com/nonara) for creating and maintaining the original
[ts-expose-internals](https://github.com/nonara/ts-expose-internals), which this fork is based on.

Thanks to [basarat](https://github.com/basarat) for his work on [byots](https://github.com/basarat/byots), which served
as the inspiration!

## Monorepo import and provenance

Generator source, tests, fixtures, publishing templates, and release state were imported from
[roblox-ts/ts-expose-internals](https://github.com/roblox-ts/ts-expose-internals/tree/82cd7cb3ddb5ddbc1644fde0d1a53d12183e5e51)
at commit `82cd7cb3ddb5ddbc1644fde0d1a53d12183e5e51`.
The root `index.d.ts` and `typescript.d.ts` are unmodified files from the published
`@roblox-ts/ts-expose-internals@5.9.3` tarball (npm SHA-1 `00d91b1cbbc6212938a4700fe9b74dfac57703a5`).
The generator's `package-files/typescript.d.ts` remains its upstream placeholder, overwritten during generation.
The package retains upstream's MIT metadata and author attribution; the declarations retain Microsoft's license header.

The local manifest is private, versioned `5.9.3`, and pins its development compiler to `=5.9.3`.
It exposes the root `index.d.ts`, which loads the `declare module "typescript"` declarations.
Do not replace that entry point with the publishing placeholder, rename the augmented module, or add a runtime entry point.
The generator and imported tests retain upstream structure and formatting to keep the import easy to compare.
Generator compilation skips dependency declaration checks because upstream's rimraf dependency tree includes declarations
incompatible with TypeScript 5.9 iterator types. The consumer augmentation test checks declarations without that exemption.

## Preserving the workspace alias

This import changes only this package directory. The workspace already includes `packages/*`, but root dependencies,
compiler dependencies, and `pnpm-lock.yaml` have not been integrated or refreshed here.
Both the root `package.json` and `packages/roblox-ts/package.json` currently use:

```json
"@types/ts-expose-internals": "npm:@roblox-ts/ts-expose-internals@=5.9.3"
```

During a separate workspace integration, use [pnpm's workspace alias syntax](https://pnpm.io/workspaces#referencing-workspace-packages-through-aliases)
to change the value in both locations while keeping the dependency key:

```json
"@types/ts-expose-internals": "workspace:@roblox-ts/ts-expose-internals@5.9.3"
```

Keep this package named `@roblox-ts/ts-expose-internals`; pnpm's workspace alias installs it under
`node_modules/@types/ts-expose-internals`. The `@types` location provides automatic inclusion, and existing
`compilerOptions.types` entries such as `"ts-expose-internals"` continue to work.
A dependency only under the scoped package's real name does not provide that automatic inclusion.
Keep every consumer's TypeScript version at `=5.9.3` until the declarations are deliberately regenerated and validated.

Then run `pnpm install` to record the new importer and alias links in the shared lockfile, followed by the package tests,
compiler build, and compiler tests. Verify both aliases resolve locally and that published consumer metadata still
resolves to `npm:@roblox-ts/ts-expose-internals@5.9.3`. The declaration package must be available in the registry before
publishing a consumer that depends on a new version. No root configuration or lockfile edits are included in this import.

## Package validation and generator maintenance

After workspace dependency installation, run from the repository root:

```sh
pnpm --dir packages/ts-expose-internals run compile
pnpm --dir packages/ts-expose-internals test
```

For isolated validation before updating the workspace lockfile:

```sh
npm install --prefix packages/ts-expose-internals --ignore-scripts --package-lock=false
npm --prefix packages/ts-expose-internals run compile
npm --prefix packages/ts-expose-internals test
```

The default suite includes upstream unit tests, mocked publishing integration, and a consumer test that installs the
`@types` alias in a temporary project and checks public and internal APIs with TypeScript 5.9.3 and `skipLibCheck: false`.
If Watchman is unavailable in a sandbox, append `-- --watchman=false` to the test command.
The live upstream test is opt-in via `test:with_live` and downloads/builds TypeScript.

`src/ts-declarations.ts` contains `buildTsDeclarations` and `fixupTsDeclarations`: the generator clones a TypeScript tag,
builds its internal declarations with `hereby dts`, and transforms the namespace into the `typescript` module declaration.
For a declaration refresh, use tag `v5.9.3` and `fixup: true`, then save the returned `dtsContent` to the root
`typescript.d.ts`. Validate it before changing the version pin. The `package-files/` directory is the publishing template,
not the local consumer entry point.

The imported `run` script is upstream release automation: it scans tags using `tsei-storage.json`, publishes packages,
commits release state, and pushes. It is not a local build command. `run -- --dry-run` suppresses publishing, commits, and pushes
but still downloads/builds matching releases and updates local release state. Default tests mock those operations.
