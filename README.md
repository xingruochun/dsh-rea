# dsh-rea

**REA (Reverse Engineer Anything) inside DSH** - 170 reverse-engineering tools as
`mcp__rea__*`, served by a local stdio MCP process.

REA is a local MCP server and CLI that wraps the reverse-engineering engines you
already have (Ghidra, Hopper, IDA, JEB, JADX, adb, mitmproxy, Chrome) behind one
tool surface. This bundle does not reimplement any of that: it installs the
`rea-agents` package and mounts the official DSH MCP client against REA's own
stdio entry point.

## What you get

| Tools | Namespace | Where the work happens |
| --- | --- | --- |
| 170 | `mcp__rea__*` | Your machine |

Binaries are never uploaded. The REA process runs locally; what reaches the
agent's context is its findings, with REA's own evidence contract attached
(evidence ids, capture tool, coverage, and explicit unknowns, so "not found" is
never reported as "does not exist").

## Install

```
dsh plugin --profile <your-profile> add https://github.com/xingruochun/dsh-rea
```

Or, in the DSH desktop app: **插件 -> 添加插件**, then paste
`https://github.com/xingruochun/dsh-rea` (a Git address is accepted directly -
this plugin does not need to be in the curated marketplace).

Restart DSH afterwards. The plugin page says so itself: "已安装，下次启动后加载。"

The install pulls `rea-agents` from npm automatically. REA ships a prebuilt
`dist/`, so no build script needs to be allowed.

## Ghidra (optional)

REA's Ghidra backend needs a local Ghidra install. Without it you still get the
other engines; Ghidra-backed operations simply report as unavailable.

If you have Ghidra, export the two variables **before** starting DSH - the
bundle passes them through to the MCP process only when they are already
defined:

```
GHIDRA_INSTALL_DIR=<absolute path to your Ghidra install>
JAVA_HOME=<absolute path to a JDK 21+ root>
```

Verified combination: Ghidra 12.1.4 + JDK 25 (Microsoft OpenJDK), Windows x64.

## Requirements

- Node.js 20+ (DSH's own runtime qualifies - it reports Node 24.18.1)
- Windows, macOS or Linux. The bundle computes the interpreter and REA's entry
  point at runtime, so nothing is tied to one machine's paths.

## Configuration

The bundle mounts one row. A profile can override any of its fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `serverName` | `rea` | Tool namespace: `mcp__rea__<tool>` |
| `toolCallTimeoutMs` | `300000` | Per-call timeout; long analyses need the headroom |
| `failOnStartupError` | `false` | Keep false: an unreachable REA degrades to a missing tool set instead of failing profile startup |
| `command` | the host's own interpreter | Override only for an unusual node installation |
| `reaEntry` | resolved from `rea-agents` | Override to point at a specific REA checkout |
| `reaArgs` | `["--mcp"]` | Arguments for REA's entry point |

## Uninstall

```
dsh plugin --profile <your-profile> remove dsh-rea
```

## License

MIT. REA itself is MIT, copyright morluto - https://github.com/morluto/rea

## Disclaimer

REA is for lawful analysis only: security research, malware and incident
analysis, vulnerability research and coordinated disclosure, CTF and education,
interoperability, software preservation, and debugging software you own or are
authorized to test. It is not for circumventing DRM, license checks or
anti-cheat, for game cheats or tampering with online services, or for defeating
authentication on systems you are not authorized to access. You are responsible
for having the authorization to analyze what you analyze.