"""line-b.py - line B's conversation with the agent through the Claude Agent SDK (29.10.2026).

Why not the `claude` command: the owner's promotional credit applies to "Agent SDK, API, Batch API, Playground, Managed
Agents" and not to Claude Code; the CLI answered "Credit balance too low". The SDK runs the same agent (it bundles the
Claude Code binary), so the method, CLAUDE.md, .claude/rules and ~/.claude/agents load as they would in the CLI.

Run (from the lines-board folder):  python tools/line-b.py   (Windows: py tools\\line-b.py)
  --continue          go on with the last conversation in the repo folder (its context kept)
  --model <alias>     default "opus" (the newest Opus); --effort low|medium|high|xhigh|max, default "high"
  --forget-key        remove the key kept in the credential store
  --ask               ask for every command (the auto rules off); by default safe commands are allowed, dangerous ones
                      refused and only the rest asked - see THE AUTO RULES below; every automatic answer is logged
Needs: Python 3.10+, `pip install claude-agent-sdk keyring`. The key: ANTHROPIC_API_KEY if set in this terminal, else
the one kept in the system's credential store (Windows Credential Manager, macOS Keychain) under "drpg-line-b"; the
first run without either reads it from the clipboard (copy it, press Enter), keeps it there and empties the clipboard.
Never printed, never sent as a message.

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


# THE AUTO RULES (the owner, 29.10.2026: "czy da sie ... nie wymagal ode mnie ciagle zgody"). Every shell command is cut
# at | ; && || and newlines; it is allowed alone when every piece starts with a word of SAFE and nothing matches DENY.
# DENY refuses outright (the agent is told why); anything else asks the owner. Every automatic answer is logged to
# <kit>/../scratch/auto-decisions.log. `--ask` turns the rules off (every command asks, as before).
import re
SAFE = set("""git npm node py python python3 cat ls dir grep rg sed awk head tail wc sort uniq cut tr echo printf for do
done while if then else fi test [ cd pwd find diff cmp mkdir cp touch bash sh rtk perl jq timeout flock export set true
false sleep basename dirname realpath readlink stat file which where tee xargs gh Get-ChildItem Get-Content Select-String
Measure-Object ForEach-Object % Write-Output Write-Host Test-Path Set-Location Get-Location Select-Object Sort-Object
Where-Object Get-Item Get-Date Format-Table Out-String Join-Path Resolve-Path New-Item Copy-Item""".split())
DENY = [r"\brm\b", r"Remove-Item", r"\bdel\b", r"rmdir", r"--force\b", r"\bpush\b[^\n]*\s-f\b", r"reset\s+--hard",
        r"git\s+clean", r"\bpush\b[^\n]*\bmain\b", r"--delete\b", r"\bpush\b[^\n]*\s:", r"find\b[^\n]*-delete",
        r"ANTHROPIC_API_KEY", r"\bkeyring\b", r"Credential", r"sk-ant-", r"gh\s+(repo|release|secret|auth\s+token)",
        r"\b(curl|wget|Invoke-WebRequest|iwr|irm)\b", r"branch\s+-D", r"stash\s+(drop|clear)", r"worktree\s+remove", r"\bnpx\b", r"\bshutdown\b", r"\bformat\b\s+[a-z]:"]
CONTROL = {"do", "then", "else", "!", "(", "{", "time"}
AUTO = "--ask" not in sys.argv
LOG = KIT.parent / "scratch" / "auto-decisions.log"
COST = KIT.parent / "scratch" / "session-cost.log"  # "<time>\t<this run's cost so far, $>" after every turn


def first_words(command):
    for piece in re.split(r"\|\||&&|[|;\n]", command):
        words = [w for w in piece.strip().lstrip("({").split() if w]
        while words and (words[0] in CONTROL or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0])):
            words.pop(0)
        if words:
            yield words[0].strip("\"'")


def rule_for(tool, data):
    """ "allow", "deny: <why>" or None (ask the owner)."""
    if tool not in ("Bash", "PowerShell"):
        path = str(data.get("file_path") or data.get("path") or "")
        if tool in ("Edit", "Write", "NotebookEdit", "MultiEdit") and path:
            inside = str(Path(path).resolve()).lower().startswith(str(KIT.parent.resolve()).lower())
            return "allow" if inside else None
        return "allow"
    command = str(data.get("command", ""))
    for pattern in DENY:
        if re.search(pattern, command, re.I):
            return f"deny: the command matches the rule {pattern!r}; ask the owner in words instead"
    words = list(first_words(command))
    return "allow" if words and all(w in SAFE for w in words) else None


def note(decision, tool, data):
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{decision}\t{tool}\t{str(data.get('command') or data.get('file_path') or '')[:400]}\n")
    except OSError:
        pass


async def ask(tool, data, _context):
    k = key_of(tool, data)
    if k in always:
        return PermissionResultAllow()
    if AUTO:
        rule = rule_for(tool, data)
        if rule == "allow":
            note("allow", tool, data)
            return PermissionResultAllow()
        if rule:
            note("deny", tool, data)
            say(f"  [refused by the auto rules: {str(data.get('command', ''))[:120]}]")
            return PermissionResultDeny(message=rule[len("deny: "):])
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


def read_clipboard():
    """The clipboard's text, by tkinter (in every python.org install) or else PowerShell's Get-Clipboard."""
    try:
        import tkinter
        root = tkinter.Tk(); root.withdraw()
        text = root.clipboard_get(); root.destroy()
        return text.strip()
    except Exception:
        import subprocess
        try:
            out = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard"], capture_output=True, text=True)
            return out.stdout.strip()
        except Exception:
            return ""


def write_clipboard(text):
    """Empty the clipboard once the key is kept, so it is not pasted somewhere by mistake."""
    try:
        import tkinter
        root = tkinter.Tk(); root.withdraw()
        root.clipboard_clear(); root.clipboard_append(text); root.update(); root.destroy()
    except Exception:
        pass


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
        # From the clipboard, not typed: Windows' hidden input (getpass) takes no paste (the owner, 29.10.2026).
        input("Copy the API key (Ctrl+C in the Console page), then press Enter here: ")
        kept = read_clipboard()
        if not kept.startswith("sk-ant-"):
            sys.exit("The clipboard holds no API key (it should start with sk-ant-); nothing was kept.")
        write_clipboard("")
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
            # The agent cannot see this terminal: the session's cost goes to a file it can read (line B's BOARD rows).
            try:
                COST.parent.mkdir(parents=True, exist_ok=True)
                with open(COST, "a", encoding="utf-8") as f:
                    f.write(f"{__import__('datetime').datetime.now().isoformat(timespec='seconds')}\t{spent:.2f}\n")
            except OSError:
                pass
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
            if line.lower() in ("y", "a", "n"):
                # A late answer to a question already settled (by the auto rules or an earlier answer) is not a message:
                # twice on 29.10.2026 a stray "a" reached the agent.
                say("  [no permission question is open; this answer is ignored, not sent]")
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
