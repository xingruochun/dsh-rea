/**
 * @xingruochun/dsh-rea — Host half.
 *
 * Mounts the official DSH MCP client (@deepseek-ai/dsh-mcp-client) at runtime and
 * points it at the REA server (npm package rea-agents, stdio transport).
 *
 * The composition row that loads this module carries only the machine-specific
 * part in its `config` (see cordis.patch.yml): env vars for the optional REA
 * engines, and optionally an explicit serverName / tool timeout. Everything that
 * must travel between machines — the node executable and the path of the REA
 * entry script — is derived here, so the bundle never hard-codes an absolute
 * path from the machine it was written on.
 */
import { createRequire } from "node:module";

export const name = "@xingruochun/dsh-rea";

const DEFAULT_SERVER_NAME = "rea";
const DEFAULT_TOOL_TIMEOUT_MS = 300000;

function resolveReaEntry(config) {
  const explicit = Array.isArray(config.args) ? config.args[0] : undefined;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const anchors = [import.meta.url];
  if (typeof process.argv[1] === "string" && process.argv[1].length > 0) {
    anchors.push(new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href);
  }
  for (const anchor of anchors) {
    try {
      return createRequire(anchor).resolve("rea-agents/scripts/rea.mjs");
    } catch {
      /* try the next anchor */
    }
  }
  return undefined;
}

function buildOptions(config) {
  const entry = resolveReaEntry(config);
  if (entry === undefined) return undefined;
  const configured = Array.isArray(config.args) ? config.args.filter((a) => typeof a === "string") : [];
  const args = configured.length > 0 ? configured : [entry, "--mcp"];
  if (configured.length === 0) args[0] = entry;
  return {
    transport: "stdio",
    serverName: config.serverName ?? DEFAULT_SERVER_NAME,
    command: config.command ?? process.execPath,
    args,
    cwd: config.cwd ?? "",
    toolCallTimeoutMs: config.toolCallTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
    env: { ELECTRON_RUN_AS_NODE: "1", ...(config.env ?? {}) },
  };
}

export async function apply(ctx, config = {}) {
  const options = buildOptions(config ?? {});
  if (options === undefined) {
    ctx.logger?.warn?.(
      "[dsh-rea] rea-agents is not installed in this profile; REA tools stay unavailable. Install it with: npm i rea-agents@6",
    );
    return;
  }
  try {
    const mod = await import("@deepseek-ai/dsh-mcp-client");
    const component = ctx.loader?.unwrapExports ? ctx.loader.unwrapExports(mod) : mod;
    ctx.plugin(component, options);
    ctx.logger?.info?.(`[dsh-rea] REA mounted as mcp__${options.serverName}__* from ${options.args[0]}`);
  } catch (error) {
    ctx.logger?.warn?.(`[dsh-rea] could not mount the DSH MCP client: ${error?.message ?? String(error)}`);
  }
}