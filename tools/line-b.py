"""line-b.py - line B's conversation with the agent through the Claude Agent SDK (29.10.2026).

Why not the `claude` command: the owner's promotional credit applies to "Agent SDK, API, Batch API, Playground, Managed
Agents" and not to Claude Code; the CLI answered "Credit balance too low". The SDK runs the same agent (it bundles the
Claude Code binary), so the method, CLAUDE.md, .claude/rules and ~/.claude/agents load as they would in the CLI.
Whether the credit counts these calls as Agent SDK is not documented: the first run is the test (see the Console usage).

Run (from the lines-board folder):  python tools/line-b.py   (Windows: py tools\\line-b.py)
Needs: Python 3.10+, `pip install claude-agent-sdk`, ANTHROPIC_API_KEY set in this terminal (never printed here).
Type a message and Enter. "exit" ends. A tool call the settings do not allow asks you: y = once, a = always for this
tool (for Bash: for commands starting with the same word), n = no.
"""
import asyncio, os, sys
from pathlib import Path

from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, PermissionResultAllow,
                              PermissionResultDeny, ResultMessage, TextBlock, ToolUseBlock)

KIT = Path(__file__).resolve().parent.parent
REPO = Path(os.environ.get("DRPG_REPO", KIT.parent / "Danganronpa-RPG")).resolve()
always = set()


def key_of(tool, data):
    if tool == "Bash":
        words = str(data.get("command", "")).split()
        return f"Bash:{words[0] if words else ''}"
    return tool


async def ask(tool, data, _context):
    k = key_of(tool, data)
    if k in always:
        return PermissionResultAllow()
    shown = data.get("command") or data.get("file_path") or data
    answer = (await asyncio.to_thread(input, f"\n[allow {tool}] {str(shown)[:300]}\n  y/a/n? ")).strip().lower()
    if answer == "a":
        always.add(k)
        return PermissionResultAllow()
    if answer == "y":
        return PermissionResultAllow()
    return PermissionResultDeny(message="The owner said no to this call.")


async def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is not set in this terminal.")
    if not (REPO / ".git").exists():
        sys.exit(f"No clone at {REPO} (set DRPG_REPO to the Danganronpa-RPG folder).")
    os.environ.setdefault("LINE_B_HOME", str(KIT))
    options = ClaudeAgentOptions(cwd=str(REPO), setting_sources=["user", "project", "local"],
                                 permission_mode="acceptEdits", can_use_tool=ask)
    spent = 0.0
    print(f"line B in {REPO}; kit {KIT}. Type 'exit' to end. Never type a key here: set it in PowerShell first.")
    async with ClaudeSDKClient(options=options) as client:
        while True:
            line = (await asyncio.to_thread(input, "\nty> ")).strip()
            if line in ("", "exit", "quit"):
                if line == "":
                    continue
                break
            if "sk-ant-" in line or "ANTHROPIC_API_KEY" in line:
                # Typed here, a key would be sent to the model as a message (it happened on 29.10.2026). Set it in
                # PowerShell before starting this program instead.
                print("  [not sent: this looks like a key or its variable. Type 'exit', set the key in PowerShell, start again.]")
                continue
            await client.query(line)
            async for msg in client.receive_response():
                if isinstance(msg, AssistantMessage):
                    for block in msg.content:
                        if isinstance(block, TextBlock):
                            print(block.text)
                        elif isinstance(block, ToolUseBlock):
                            print(f"  [{block.name}] {str(block.input)[:160]}")
                elif isinstance(msg, ResultMessage):
                    cost = getattr(msg, "total_cost_usd", None)
                    if isinstance(cost, (int, float)):
                        spent = cost
                    print(f"  [{msg.subtype}; cost so far: ${spent:.2f}]" if spent else f"  [{msg.subtype}]")


if __name__ == "__main__":
    asyncio.run(main())
