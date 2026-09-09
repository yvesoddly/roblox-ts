# Import notes

Imported from [roblox-ts/vscode-roblox-ts](https://github.com/roblox-ts/vscode-roblox-ts)
at commit `b01fc210739e620fc34f2fbc8d2bdfd2ca206eb3` (version 1.9.1).
The upstream README, icon, extension contributions, activation event and command
behavior are preserved. This revision contains no LICENSE file or license field;
no license is inferred from this repository's MIT license. Resolve this upstream
licensing gap before distributing the extension.

Standalone editor scaffolding, the unused quickstart and npm lockfile were omitted.
The original test command referenced a missing runner. Node tests now exercise
plugin configuration, color detection, output path selection and compiler process
control with a simulated VS Code host. Runtime code is unchanged except that
cancellation checks for a PID when spawning the compiler failed.

## Workspace integration

- `@roblox-ts/path-translator` and `roblox-ts-extensions` use `workspace:*`.
- TypeScript is pinned to the workspace's 5.9.3. Node declarations match the
  workspace; VS Code declarations are pinned to the existing 1.52 API floor.
  The upstream TypeScript 5.4 already required Node 14.17, newer than the Node 12
  shipped by VS Code 1.52. The existing manifest engine is preserved, not a claim
  of tested compatibility with that oldest editor. Minimum editor/runtime support
  needs a separate compatibility decision before release.
- Removed unused Mocha/glob/vscode-test dependencies and the obsolete ESLint
  `@typescript-eslint/semi` rule, which does not exist in the declared plugin.
- The existing workspace glob and recursive build need no changes. Updating the
  shared lockfile, adding this package to root `test-packages`, and scoping root
  lint/format checks for preserved upstream style are left to the integrator.

## Local commands

After a workspace install and building the workspace dependencies, run from the
repository root:

```sh
pnpm --filter vscode-roblox-ts build
pnpm --filter vscode-roblox-ts test
pnpm --filter vscode-roblox-ts lint
pnpm --filter vscode-roblox-ts run package
```

Packaging stages the compiled extension and installed production dependency
closure outside the repository, dereferences workspace links, and replaces runtime
workspace ranges with installed versions. VSCE uses npm dependency discovery on
this conventional staged tree rather than traversing pnpm links directly. The result
is `vscode-roblox-ts-1.9.1.vsix` in this directory; an optional output path can be
passed with `npm run package --prefix packages/vscode-roblox-ts -- /tmp/extension.vsix`.
VSCE's missing-license check is explicitly skipped
for local artifact inspection, not to grant distribution permission. Tests, maps,
TypeScript sources, build metadata and standalone lockfiles are excluded.

## Validation

Validation uses Node 24.19.0 and npm 11.17.0, with dependency installs in temporary
folders and an ignored package-local `node_modules` symlink. The runtime packages
are the imported language service and a clean scratch build of this repository's
path translator, not registry replacements. The original frozen npm install fails
because its lockfile is inconsistent. Resolving its original ranges also exposes
obsolete glob declarations and Node 12/modern TypeScript declaration conflicts.

Build, all four Node tests, and package-local ESLint pass. The failed-spawn test
also fails against upstream output, demonstrating the narrow PID regression.
Packaging produced a 669-entry, 4.54 MB VSIX. Inspection verified extension and
language-service entrypoints, Rojo schema, dependency licenses, TypeScript runtime,
unchanged icon bytes, no workspace dependency protocols, and no tests, scripts,
TypeScript sources, source maps or build metadata. The four tests pass again
against the unpacked artifact. The coordinator independently verified packaging
with actual pnpm workspace links and ran all four extension and seven language
service tests against its extracted VSIX outside the workspace dependency tree.

An isolated VS Code 1.136.1 development host loaded the unpacked extension using
separate temporary user-data and extensions directories. Real-host assertions
passed for activation, all three command registrations, RGB color detection and
Open Output. A completion request exercised TypeScript's service; both syntax and
semantic server logs confirm the imported plugin loaded and passed validation in
a project declaring `@rbxts/compiler-types`. No extension was installed into the
normal user profile. Actual compiler spawning and the oldest supported editor
were not exercised in the real host.

A package-local `.gitattributes` keeps the icon binary despite the root text rule;
filtered and unfiltered Git hashes match. Root lint/format still needs scoped
integration for upstream style; its configuration and lockfile remain untouched.
