/**
 * @xingruochun/dsh-rea  Host half.
 *
 * This bundle does not do any reverse engineering itself. It mounts ONE row:
 * the official DSH MCP client, wired to REA's own stdio MCP entry point. The
 * 170 tools come from the REA process and show up as `mcp__rea__*`.
 *
 * Why the wiring lives here and not in cordis.patch.yml
 * -----------------------------------------------------
 * A patch that inserts a component in the protected `@deepseek-ai` namespace is
 * hard-blocked by plugin-store prechecks (the whole patch text is scanned,
 * comments included), rated `route: blocked`  the strictest outcome. The
 * accepted shape is the one this file follows: the patch inserts *only this
 * package*, and `apply()` below mounts the official client at runtime.
 * See the misakanet bundle for the same arrangement and its incident notes.
 *
 * Why nothing here is hard-coded to one machine
 * ---------------------------------------------
 * The published bundle has to work on somebody else's disk, username and node
 * installation. So:
 *   * the interpreter is `process.execPath` (the node that is running the host)
 *   * REA's entry point is resolved from this package's own dependency tree
 *   * GHIDRA_INSTALL_DIR / JAVA_HOME are passed through only when the host
 *     environment already defines them  absent means "Ghidra unavailable",
 *     which is a degradation, not an error.
 */

export const name = '@xingruochun/dsh-rea';

/** Defaults for the row this bundle mounts. A profile may override any of them. */
export const DEFAULT_MCP_CONFIG = Object.freeze({
  serverName: 'rea',
  transport: 'stdio',
  toolCallTimeoutMs: 300000,
  failOnStartupError: false,
  reaArgs: ['--mcp'],
});

/**
 * Locate REA's stdio entry point (`rea-agents/scripts/rea.mjs`).
 *
 * Two attempts, because the two install shapes resolve differently:
 *   1. a normal `npm install`  the bare specifier resolves from this package;
 *   2. a linked working tree  Node resolves the link to its real path, so the
 *      walk starts outside the profile; we then search upwards by hand.
 *
 * @returns {Promise<string|undefined>} absolute path, or undefined when absent.
 */
async function resolveReaEntry() {
  try {
    const { createRequire } = await import('node:module');
    try {
      return createRequire(import.meta.url).resolve('rea-agents/scripts/rea.mjs');
    } catch (error) { /* fall through to the manual walk */ }

    const { existsSync } = await import('node:fs');
    const { dirname, join, resolve } = await import('node:path');
    let dir = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = join(dir, 'node_modules', 'rea-agents', 'scripts', 'rea.mjs');
      if (existsSync(candidate)) return candidate;
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  } catch (error) { /* treated as "not resolvable" by the caller */ }
  return undefined;
}

/**
 * Build the MCP client options for this machine.
 *
 * @returns {Promise<object|undefined>} options, or undefined when REA is not installed.
 */
async function buildOptions(ctx, config) {
  const options = { ...DEFAULT_MCP_CONFIG, ...config };
  const entry = options.reaEntry ?? await resolveReaEntry();
  if (entry === undefined) {
    ctx?.logger?.warn?.(
      '@xingruochun/dsh-rea: rea-agents is not installed, so the REA tools are not mounted. '
      + 'Install it in the profile that carries this bundle: npm install rea-agents',
    );
    return undefined;
  }

  const env = {};
  // Electron-as-node: the host's own interpreter is an Electron binary, and the
  // DSH runtime ships exactly this switch in `runtime/bin/node.cmd`. A plain
  // node ignores it.
  env.ELECTRON_RUN_AS_NODE = '1';
  for (const key of ['GHIDRA_INSTALL_DIR', 'JAVA_HOME']) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) env[key] = value;
  }

  return {
    serverName: options.serverName,
    transport: options.transport,
    command: options.command ?? process.execPath,
    args: [entry, ...(options.reaArgs ?? DEFAULT_MCP_CONFIG.reaArgs)],
    env,
    toolCallTimeoutMs: options.toolCallTimeoutMs,
    failOnStartupError: options.failOnStartupError,
  };
}

/**
 * Mount the official MCP client against REA.
 *
 * NOTHING BELOW MAY THROW OUT OF THIS FUNCTION. A throw here is a failed
 * activation, and a failed activation inside a profile bundle can stop the
 * whole host from starting  for a feature whose worst case should be "the
 * tools are missing". Every branch reports through the host logger instead.
 */
export async function apply(ctx, config = {}) {
  try {
    if (typeof ctx?.plugin !== 'function') {
      ctx?.logger?.warn?.('@xingruochun/dsh-rea: cordis context has no plugin(); REA tools not mounted');
      return;
    }

    const options = await buildOptions(ctx, config);
    if (options === undefined) return;

    let client;
    try {
      client = await import('@deepseek-ai/dsh-mcp-client');
    } catch (error) {
      ctx?.logger?.warn?.(
        '@xingruochun/dsh-rea: @deepseek-ai/dsh-mcp-client is not resolvable, so the REA tools are not '
        + `mounted: ${error?.message ?? error}`,
      );
      return;
    }

    // The Loader normalizes ESM/CJS/default export shapes before applying a plugin.
    const component = ctx?.loader?.unwrapExports ? ctx.loader.unwrapExports(client) : client;
    ctx.plugin(component, options);
  } catch (error) {
    ctx?.logger?.warn?.(`@xingruochun/dsh-rea: MCP client not mounted: ${error?.message ?? error}`);
  }
}