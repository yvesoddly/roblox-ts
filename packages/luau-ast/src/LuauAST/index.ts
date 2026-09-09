import * as luau from "LuauAST/bundle";

// keep the binding live when renderer imports cycle back through this entry point
export { luau as default };

export * from "LuauRenderer";
