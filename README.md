# Agent Cats

A [Claude Code](https://claude.com/claude-code) mod that turns the agents of a session into a dashboard of cats.

- **One cat per agent.** The main agent and every subagent each get their own colour: an SVG cat on the desktop app and VS Code, `ᓚᘏᗢ` in the terminal.
- **What each cat is doing.** Every cat shows its task, its status, how long it has run, its agent type, the tool it is using now and the skills it has loaded.
- **Asleep or done.** When a subagent finishes, its cat changes status:
  - **sleeping** if `SendMessage` can still reach it. Give it a new task in its field and the main agent wakes it.
  - **done** if it failed, was stopped or cannot be addressed.
  - **Close it** when you no longer need to wake it.
- **Questions answered in place.** When an agent asks you something (`AskUserQuestion`), the question appears at the top of the dashboard with a meow, played once per question.
  - Pick an option, or type your own answer.
  - The engine's own dialog is replaced by a pointer to the dashboard. **Use the native dialog** is a fallback.
  - Permission prompts appear too, with the same meow. Allow / Deny stays in the engine's own dialog: only the engine may grant a permission.
- **Rename cats.** Give any cat a name of your own with **✎ 改名**.
- **Skills:**
  - **＋Skill** on a cat hands it one of your installed skills. A running agent reads the request at its next step. A sleeping subagent is woken with it. An idle main agent gets it as a prompt.
  - **搵新 skill** asks the main agent to search the skill and plugin catalogs and show install cards. Nothing is installed until you approve a card.
  - **今次任務用嘅 skills** picks the skills for the work at hand, in one of two modes:
    - **優先用** (prefer): every prompt and new subagent is told to use them.
    - **只准用** (only): every other skill is refused.

The interface text is in Traditional Chinese (Cantonese).

## Requirements

Claude Code **2.1.286 or later**: the first release with mods (function hooks).

## Install

In Claude Code:

```
/plugin marketplace add anthonyzng/agent-cats
/plugin install agent-cats@agent-cats
```

Then open the dashboard with `/cats`. The pane also opens by itself when a session starts on a wide enough window, and whenever an agent asks you something.

To update later:

```
/plugin marketplace update agent-cats
```

### From a local copy

```bash
git clone https://github.com/anthonyzng/agent-cats.git
claude --plugin-dir ./agent-cats
```

Hosts that cannot take a flag, such as the desktop app, read the same folders from `CLAUDE_CODE_PLUGIN_DIRS`. Set it in the `env` block of `~/.claude/settings.json` to an absolute path.

## Things to know

- **Mods are not sandboxed.** This one runs inside Claude Code with your permissions, like every mod. Read `hooks/register.tsx` before you install it. It makes no network calls and writes no files. The only external thing it touches is the bundled sound, `sounds/meow.wav`.
- **"Only" mode applies to every agent of the session**, the main one included.
- **The dashboard holds still while you use it.** While you are in one of its dropdowns or text fields, its once-a-second updates wait, so an open dropdown does not jump back to its top.
  - This works in the terminal.
  - The desktop app does not say which element took focus, so there an open dropdown can still be redrawn while an agent is working.
  - When every agent is idle, the dashboard does not redraw at all.
- **`/cats` prints a diagnostic line:** how many skills it found, how often the pane drew and the last focus moves.
- **Playing the meow.** It uses Claude Code's own audio player. Where none is available you still get the toast.

## Development

```bash
claude plugin validate .   # what the module hooks and calls, and anything the engine would refuse
claude plugin test .       # tests/*.test.tsx against the engine itself
python scripts/make-meow.py  # regenerate sounds/meow.wav (stdlib only)
```

Claude Code writes the type declarations into `.claude-plugin/types/` when it loads the mod. `tsconfig.json` extends them, so `tsc -p .` type-checks the module.

## License

[MIT](LICENSE)
