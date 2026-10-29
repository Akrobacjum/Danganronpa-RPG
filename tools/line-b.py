"""line-b.py - line B's conversation with the agent through the Claude Agent SDK (29.10.2026).

Why not the `claude` command: the owner's promotional credit applies to "Agent SDK, API, Batch API, Playground, Managed
Agents" and not to Claude Code; the CLI answered "Credit balance too low". The SDK runs the same agent (it bundles the
Claude Code binary), so the method, CLAUDE.md, .claude/rules and ~/.claude/agents load as they would in the CLI.

Run (from the lines-board folder):  python tools/line-b.py   (Windows: py tools\\line-b.py)
  --continue          go on with the last conversation in the repo folder (its context kept)
  --model <alias>     default "opus" (the newest Opus); --effort low|medium|high|xhigh|max, default "high"
  --forget-key        remove the key kept in the credential store
Needs: Python 3.10+, `pip install claude-agent-sdk keyring`. The key: ANTHROPIC_API_KEY if set in this terminal, else
the one kept in the system's credential store (Windows Credential Manager, macOS Keychain) under "drpg-line-b"; the
first run without either asks for it with hidden input and keeps it there. Never printed, never sent as a message.

ONE READER OF THE KEYBOARD (fix of 29.10.2026). The first version read the keyboard in two places at once - the message
prompt and the permission question - so when a subagent working in the background asked for a permission while the
program waited for a message, the owner's "a" went out as a message and the question stayed unanswered. Now one reader
takes every line: while a permission question is open, the line answers it (y = once, a = always for this tool - for
Bash, for commands starting with the same word - n = no); otherwise the line is a message to the agent. Everything
the agent sends, also between turns, is printed as it comes.
"""
import asyncio, os, sys
from pathlib import Path

from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, PermissionResultAllow,
                              PermissionResultDeny, ResultMessage, TextBlock, ToolUseBlock)

KIT = Path(__file__).resolve().parent.parent
REPO = Path(os.environ.get("DRPG_REPO", KIT.parent / "Danganronpa-RPG")).resolve()
SERVICE, ACCOUNT = "drpg-line-b", "anthropic"
always = set()
questions = []          # open permission questions, oldest first: (prompt text, future)
busy = {"turn": False}  # whether the agent is answering a message


def say(text):
    print(text, flush=True)


def arg(flag, default):
    """The value after `flag` on the command line, else the default."""
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


def key_of(tool, data):
    if tool == "Bash":
        words = str(data.get("command", "")).split()
        return f"Bash:{words[0] if words else ''}"
    return tool


def show_question():
    if questions:
        extra = f" (+{len(questions) - 1} more waiting)" if len(questions) > 1 else ""
        say(f"\n>>> PERMISSION{extra}: {questions[0][0]}\n>>> answer y / a / n and Enter")


async def ask(tool, data, _context):
    k = key_of(tool, data)
    if k in always:
        return PermissionResultAllow()
    shown = data.get("command") or data.get("file_path") or data
    future = asyncio.get_running_loop().create_future()
    questions.append((f"[{tool}] {str(shown)[:300]}", future))
    if len(questions) == 1:
        show_question()
    answer = await future
    if answer == "a":
        always.add(k)
        return PermissionResultAllow()
    if answer == "y":
        return PermissionResultAllow()
    return PermissionResultDeny(message="The owner said no to this call.")


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
                say("The kept key is removed from the credential store.")
            except Exception:
                say("No kept key to remove.")
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
        say("Kept. Next runs start without asking; `--forget-key` removes it.")
    os.environ["ANTHROPIC_API_KEY"] = kept


async def printer(client, effort):
    """Every message the agent sends, as it comes - during a turn and between turns."""
    seen_model, spent = None, 0.0
    async for msg in client.receive_messages():
        if isinstance(msg, AssistantMessage):
            if getattr(msg, "model", None) and msg.model != seen_model:
                seen_model = msg.model
                say(f"  [model: {seen_model}; effort asked: {effort}]")
            for block in msg.content:
                if isinstance(block, TextBlock):
                    say(block.text)
                elif isinstance(block, ToolUseBlock):
                    say(f"  [{block.name}] {str(block.input)[:160]}")
        elif isinstance(msg, ResultMessage):
            busy["turn"] = False
            cost = getattr(msg, "total_cost_usd", None)
            if isinstance(cost, (int, float)):
                spent = cost
            say(f"  [{msg.subtype}; cost so far: ${spent:.2f}]" if spent else f"  [{msg.subtype}]")
            if not questions:
                say("\nty> (type a message and Enter)")


async def main():
    load_key()
    if not (REPO / ".git").exists():
        sys.exit(f"No clone at {REPO} (set DRPG_REPO to the Danganronpa-RPG folder).")
    os.environ.setdefault("LINE_B_HOME", str(KIT))
    model, effort = arg("--model", "opus"), arg("--effort", "high")
    if effort not in ("low", "medium", "high", "xhigh", "max"):
        sys.exit(f"--effort must be low, medium, high, xhigh or max (got {effort}).")
    options = ClaudeAgentOptions(cwd=str(REPO), setting_sources=["user", "project", "local"],
                                 permission_mode="acceptEdits", can_use_tool=ask, model=model, effort=effort,
                                 continue_conversation="--continue" in sys.argv)
    say(f"line B in {REPO}; kit {KIT}.{' Going on with the last conversation.' if '--continue' in sys.argv else ''}")
    say("Type a message and Enter; 'exit' ends. Never type a key here.\n\nty> (type a message and Enter)")
    async with ClaudeSDKClient(options=options) as client:
        show = asyncio.create_task(printer(client, effort))
        while True:
            line = (await asyncio.to_thread(sys.stdin.readline)).strip()
            if questions:
                if line.lower() not in ("y", "a", "n"):
                    say(">>> a permission question is open: answer y, a or n first")
                    show_question()
                    continue
                _, future = questions.pop(0)
                future.set_result(line.lower())
                show_question()
                continue
            if not line:
                continue
            if line in ("exit", "quit"):
                break
            if "sk-ant-" in line or "ANTHROPIC_API_KEY" in line:
                say("  [not sent: this looks like a key or its variable. Set the key in PowerShell before starting.]")
                continue
            if busy["turn"]:
                say("  [sent while the agent is still answering: it reads it as soon as it can]")
            busy["turn"] = True
            await client.query(line)
        show.cancel()


if __name__ == "__main__":
    asyncio.run(main())
