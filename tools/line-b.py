"""line-b.py - line B's conversation with the agent through the Claude Agent SDK (29.10.2026).

Why not the `claude` command: the owner's promotional credit applies to "Agent SDK, API, Batch API, Playground, Managed
Agents" and not to Claude Code; the CLI answered "Credit balance too low". The SDK runs the same agent (it bundles the
Claude Code binary), so the method, CLAUDE.md, .claude/rules and ~/.claude/agents load as they would in the CLI.
Whether the credit counts these calls as Agent SDK is not documented: the first run is the test (see the Console usage).

Run (from the lines-board folder):  python tools/line-b.py   (Windows: py tools\\line-b.py)
Needs: Python 3.10+, `pip install claude-agent-sdk keyring`. The key: ANTHROPIC_API_KEY if set in this terminal, else
the one kept in the system's credential store (Windows Credential Manager, macOS Keychain) under "drpg-line-b". The
first run without either asks for it with hidden input and keeps it there; `--forget-key` removes it. Never printed.
Model and effort: the newest Opus at effort "high" unless `--model <alias or name>` / `--effort low|medium|high|xhigh|max`
say otherwise (the model's own default effort is "medium"). The model that answers is printed with the first reply.
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


SERVICE, ACCOUNT = "drpg-line-b", "anthropic"


def arg(flag, default):
    """The value after `flag` on the command line, else the default."""
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def load_key():
    """The key into this process's environment (the SDK reads it there), from the terminal or the credential store."""
    try:
        import keyring
    except ImportError:
        keyring = None
    if "--forget-key" in sys.argv:
        if keyring:
            try:
                keyring.delete_password(SERVICE, ACCOUNT)
                print("The kept key is removed from the credential store.")
            except Exception:
                print("No kept key to remove.")
        sys.exit(0)
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    kept = keyring.get_password(SERVICE, ACCOUNT) if keyring else None
    if not kept:
        if not keyring:
            sys.exit("No key: set ANTHROPIC_API_KEY in this terminal, or `py -m pip install keyring` to keep it once.")
        import getpass
        kept = getpass.getpass("API key (hidden, kept in the system's credential store for the next runs): ").strip()
        if not kept.startswith("sk-ant-"):
            sys.exit("That does not look like an API key; nothing was kept.")
        keyring.set_password(SERVICE, ACCOUNT, kept)
        print("Kept. Next runs start without asking; `--forget-key` removes it.")
    os.environ["ANTHROPIC_API_KEY"] = kept


async def main():
    load_key()
    if not (REPO / ".git").exists():
        sys.exit(f"No clone at {REPO} (set DRPG_REPO to the Danganronpa-RPG folder).")
    os.environ.setdefault("LINE_B_HOME", str(KIT))
    model, effort = arg("--model", "opus"), arg("--effort", "high")
    if effort not in ("low", "medium", "high", "xhigh", "max"):
        sys.exit(f"--effort must be low, medium, high, xhigh or max (got {effort}).")
    options = ClaudeAgentOptions(cwd=str(REPO), setting_sources=["user", "project", "local"],
                                 permission_mode="acceptEdits", can_use_tool=ask, model=model, effort=effort)
    seen_model = None
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
                    if getattr(msg, "model", None) and msg.model != seen_model:
                        seen_model = msg.model
                        print(f"  [model: {seen_model}; effort asked: {effort}]")
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
