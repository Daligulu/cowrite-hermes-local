# dashiai-ppt Rendering Workflow

## Prerequisites
1. Skill directory must contain the full repo (not just SKILL.md)
2. Run `npm install` in `<skill-root>/project/` before first use
3. Node.js 18+ required

## Parameter format (critical!)
The render script uses **positional arguments**, NOT `--flag` syntax:
```bash
# WRONG (will be interpreted as a filename):
node scripts/render-goal-deck.jsx --goal <path> --out <path>

# CORRECT:
npx tsx scripts/render-goal-deck.jsx <goal.json> <output/index.html>
```

Or via npm:
```bash
npm run render:goal -- <goal.json> <output/index.html>
```

## Layout selection by copy budget
Each layout has strict character limits per field. Use inspect to find suitable layouts:
```bash
node scripts/layout-query.mjs --theme theme01 --limit 20 | python3 -c "
import sys, json, re
raw = sys.stdin.read()
m = re.search(r'(\[.*\])', raw, re.DOTALL)
data = json.loads(m.group(1))
for s in data:
    budgets = s.get('copyBudgets', {})
    for k,v in budgets.items():
        if v.get('maxChars', 0) >= 80:
            print(f\"{s['layout']} | {s.get('label','?')} | {k}: {v['maxChars']} chars\")
"
```

Key layouts with long-text support in theme01:
- `theme01_page015` (算力上游) — lead field up to 80 chars
- `theme01_page013` (章节·横向透视) — desc field up to 69 chars
- `theme01_page011` (章节·市场全景) — desc field up to 61 chars

## Iterative goal.json editing
1. Scaffold: `npm run goal:scaffold -- --title <t> --goal <g> --theme <tp> --pages <n> --out <dir>/goal.json`
2. Inspect layouts: `node scripts/inspect-layout.mjs --compact <layout1> <layout2>`
3. Edit goal.json props to fit field budgets
4. Validate: `npm run validate:goal-spec -- --goal <file>`
5. Render: `npx tsx scripts/render-goal-deck.jsx <goal.json> <output>`

## Common error patterns
- `ERR_UNKNOWN_FILE_EXTENSION .jsx` — use `tsx` not `node` directly
- `Could not render: ENOENT --goal` — positional args, not named flags
- `brief copy is too long` — reduce text to match field maxChars
- `Missing --theme` — scaffold requires --theme flag explicitly
