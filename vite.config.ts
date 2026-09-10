import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@roblox-ts\/luau-ast$/,
        replacement: fileURLToPath(new URL("./packages/luau-ast/src/LuauAST", import.meta.url)),
      },
      {
        find: /^(LuauAST|LuauRenderer)(?=\/|$)/,
        replacement: fileURLToPath(new URL("./packages/luau-ast/src/", import.meta.url)) + "$1",
      },
      {
        find: /^(Project|Shared|TSTransformer)(?=\/|$)/,
        replacement: fileURLToPath(new URL("./packages/roblox-ts/src/", import.meta.url)) + "$1",
      },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/compiler/**/*.test.ts", "packages/luau-ast/tests/**/*.test.ts"],
    reporters: ["verbose"],
    // compiler integration tests build real projects, including under coverage instrumentation
    testTimeout: 30_000,
    coverage: {
      provider: "istanbul",
      include: ["packages/roblox-ts/src/**/*.ts", "packages/luau-ast/src/**/*.ts"],
      exclude: [
        "packages/roblox-ts/src/index.ts",
        "packages/roblox-ts/src/browser.ts",
        "packages/roblox-ts/src/Shared/util/patchFs.ts",
        "packages/roblox-ts/src/Shared/classes/LogService.ts",
        "packages/roblox-ts/src/TSTransformer/util/getFlags.ts",
        "packages/roblox-ts/src/TSTransformer/util/getKindName.ts",
        "packages/roblox-ts/src/TSTransformer/util/jsx/constants.ts",
      ],
      reportsDirectory: "coverage",
      reporter: ["lcov", "text"],
    },
  },
  lint: {
    plugins: ["typescript"],
    categories: {
      correctness: "warn",
    },
    options: {
      // TypeScript 5.9 and tspc remain responsible for build type checking
      typeAware: true,
      maxWarnings: 0,
      reportUnusedDisableDirectives: "warn",
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      // preserve the imported generator and exact TypeScript declarations; its own compile/tests run in CI
      "packages/ts-expose-internals/",
      // imported packages retain their own lint and formatting conventions
      "packages/create-roblox-ts/",
      "packages/roblox-ts-extensions/",
      "packages/vscode-roblox-ts/",
      "packages/eslint-plugin-roblox-ts/",
      ".local/",
      ".pnpm-store/",
      "**/node_modules/",
      "tests/src/",
      "tests/projects/",
      "tests/out/",
      "tests/include/",
      "tests/node_modules/",
      "**/out/",
      "coverage/",
      "devlink/",
    ],
    rules: {
      "constructor-super": "error",
      "for-direction": "error",
      "getter-return": "error",
      "no-async-promise-executor": "error",
      "no-case-declarations": "error",
      "no-class-assign": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": "error",
      "no-const-assign": "error",
      "no-constant-binary-expression": "error",
      "no-constant-condition": [
        "error",
        {
          checkLoops: false,
        },
      ],
      "no-control-regex": "error",
      "no-delete-var": "error",
      "no-dupe-class-members": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-empty-static-block": "error",
      "no-ex-assign": "error",
      "no-fallthrough": "error",
      "no-func-assign": "error",
      "no-global-assign": "error",
      "no-import-assign": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-loss-of-precision": "error",
      "no-misleading-character-class": "error",
      "no-new-native-nonconstructor": "error",
      "no-nonoctal-decimal-escape": "error",
      "no-obj-calls": "error",
      "no-prototype-builtins": "error",
      "no-redeclare": "error",
      "no-regex-spaces": "error",
      "no-self-assign": "error",
      "no-setter-return": "error",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "no-this-before-super": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "no-unused-labels": "error",
      "no-unused-private-class-members": "error",
      "no-unused-vars": "warn",
      "no-useless-backreference": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-with": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-array-constructor": "error",
      "no-unused-expressions": "warn",
      curly: ["warn", "multi-line", "consistent"],
      "eslint-comments/disable-enable-pair": [
        "warn",
        {
          allowWholeFile: true,
        },
      ],
      "eslint-comments/require-description": "warn",
      "no-console": "warn",
      "prefer-const": [
        "warn",
        {
          destructuring: "all",
        },
      ],
      "simple-import-sort/exports": "warn",
      "simple-import-sort/imports": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [".*"],
        },
      ],
      "typescript/ban-ts-comment": "error",
      "typescript/no-duplicate-enum-values": "error",
      "typescript/no-empty-object-type": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-extra-non-null-assertion": "error",
      "typescript/no-misused-new": "error",
      "typescript/no-non-null-asserted-optional-chain": "error",
      "typescript/no-require-imports": "error",
      "typescript/no-this-alias": "error",
      "typescript/no-unnecessary-type-constraint": "error",
      "typescript/no-unsafe-declaration-merging": "error",
      "typescript/no-unsafe-function-type": "error",
      "typescript/no-wrapper-object-types": "error",
      "typescript/prefer-as-const": "error",
      "typescript/prefer-namespace-keyword": "error",
      "typescript/triple-slash-reference": "error",
      "typescript/array-type": [
        "error",
        {
          default: "generic",
          readonly: "generic",
        },
      ],
      "typescript/no-deprecated": "error",
      "typescript/no-floating-promises": [
        "error",
        {
          ignoreVoid: true,
        },
      ],
    },
    overrides: [
      {
        files: [".pnpmfile.cjs", "tests/toolchain/**/*.cjs"],
        rules: {
          "typescript/no-require-imports": "off",
        },
      },
      {
        files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
        rules: {
          "constructor-super": "off",
          "getter-return": "off",
          "no-class-assign": "off",
          "no-const-assign": "off",
          "no-dupe-class-members": "off",
          "no-dupe-keys": "off",
          "no-func-assign": "off",
          "no-import-assign": "off",
          "no-new-native-nonconstructor": "off",
          "no-obj-calls": "off",
          "no-redeclare": "off",
          "no-setter-return": "off",
          "no-this-before-super": "off",
          "no-unreachable": "off",
          "no-unsafe-negation": "off",
          "no-var": "error",
          "no-with": "off",
          "prefer-rest-params": "error",
          "prefer-spread": "error",
        },
      },
      {
        // ambient standard-library declarations use explicit references and broad callable types
        files: ["packages/compiler-types/types/*.d.ts"],
        rules: {
          "no-unused-vars": "off",
          "typescript/triple-slash-reference": "off",
          "typescript/no-empty-object-type": "off",
          "typescript/no-explicit-any": "off",
        },
      },
      {
        // TypeScript requires these globals even though using them directly is deprecated
        files: ["packages/compiler-types/types/core.d.ts"],
        rules: {
          "typescript/no-deprecated": "off",
        },
      },
      {
        // public node interfaces specialize their syntax kind without adding fields
        files: ["packages/luau-ast/src/LuauAST/types/nodes.ts"],
        rules: {
          "typescript/no-empty-object-type": [
            "error",
            {
              allowInterfaces: "with-single-extends",
            },
          ],
        },
      },
      {
        files: ["tests/compiler/**/*.ts"],
        rules: {
          "no-restricted-imports": "off",
        },
      },
    ],
  },
  fmt: {
    sortImports: true,
    ignorePatterns: [
      // preserve the imported generator and exact TypeScript declarations; its own compile/tests run in CI
      "packages/ts-expose-internals/",
      // imported packages retain their own lint and formatting conventions
      "packages/create-roblox-ts/",
      "packageseroblox-ts-extensions/",
      "packages/vscode-roblox-ts/",
      "packages/eslint-plugin-roblox-ts/",
      ".local/",
      ".pnpm-store/",
      "**/node_modules/",
      "tests/src/",
      "tests/projects/",
      "tests/out/",
      "tests/include/",
      "tests/node_modules/",
      "**/out/",
      "coverage/",
      "devlink/",
      "*.yml",
      "pnpm-lock.yaml",
      "packages/*/CHANGELOG.md",
      "**/__snapshots__/**",
      "packages/compiler-types/types/eslintIgnore.d.ts",
    ],
  },
});
