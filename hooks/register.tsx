import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CatAgent, CatPending, CatQuestion, CatStatus, SkillMode } from '../types'

const PANE = 'agent-cats'
const TITLE = 'Agent 貓貓'
const MAIN = 'main'
const MAIN_COLOR = '#F4A261'
const PALETTE = ['#2B2D42', '#F5F5F5', '#E76F51', '#8E7DBE', '#2A9D8F', '#E9C46A', '#6C757D', '#F28482', '#4D96FF']

const agents = atom({ plugin: 'agent-cats', key: 'agents' } as const, [])
const pending = atom({ plugin: 'agent-cats', key: 'pending' } as const, [])
const clockNow = atom({ plugin: 'agent-cats', key: 'now' } as const, 0)
const native = atom({ plugin: 'agent-cats', key: 'native' } as const, [])
const skills = atom({ plugin: 'agent-cats', key: 'skills' } as const, [])
const activeSkills = atom({ plugin: 'agent-cats', key: 'activeSkills' } as const, [])
const skillMode = atom({ plugin: 'agent-cats', key: 'skillMode' } as const, 'prefer')

const skillFilter = atom({ plugin: 'agent-cats', key: 'skillFilter' } as const, '')

const renaming = atom({ plugin: 'agent-cats', key: 'renaming' } as const, '')

// While the person is in one of the dashboard's pickers or text fields, the
// once-a-second clock redraw would redraw it under them (an open dropdown
// jumps back to its top), so the clock holds until focus leaves, at most this long.
const HOLD_MS = 60_000
const HOLD_ELEMENT = /^(give-|active-add|skill-filter|skill-search|wake-|other-|rename-)/
let holdUntil = 0
// Diagnostics for /cats: how often the pane drew, and the last focus moves.
let renders = 0
const writes: Record<string, number> = {}
const wrote = (key: string) => {
  writes[key] = (writes[key] ?? 0) + 1
}
const focusSeen: string[] = []

async function isHolding($: EngineInterface): Promise<boolean> {
  return holdUntil > 0 && (await $.clock.now()) < holdUntil
}

const PICK_HINT = '__pick__'
// A Select takes at most 64 options: the hint plus this many skills.
const MAX_SKILL_OPTIONS = 63

// The hint first, then the skills that match the filter, capped to what a
// Select can hold; the hint says how many the filter is hiding.
function skillOptions(names: readonly string[], filter: string, hint: string): { value: string; label?: string }[] {
  const needle = filter.trim().toLowerCase()
  const matches = needle ? names.filter(n => n.toLowerCase().includes(needle)) : [...names]
  const shown = matches.slice(0, MAX_SKILL_OPTIONS)
  const hidden = matches.length - shown.length
  const label =
    matches.length === 0
      ? `— 冇 skill 符合「${filter.trim()}」—`
      : hidden > 0
        ? `${hint}（仲有 ${hidden} 個，喺上面打字篩選）`
        : hint

  return [{ value: PICK_HINT, label }, ...shown.map(n => ({ value: n }))]
}

type Answers = Record<string, string>

// Lives with this module: after a reload the old waits are gone, so their
// questions fall back to the engine's own dialog.
const resolvers = new Map<string, (answers: Answers) => void>()

const STATUS_TEXT: Record<CatStatus, string> = {
  working: '工作中',
  sleeping: '休眠（可喚醒）',
  closed: '已結束',
}

const STATUS_COLOR: Record<CatStatus, string> = {
  working: '#2A9D8F',
  sleeping: '#8E7DBE',
  closed: '#888888',
}

function catStatusOf(info: { status: string; name?: string }): CatStatus {
  if (info.status === 'running' || info.status === 'pending') {
    return 'working'
  }
  // A finished agent that SendMessage can still address sleeps until woken;
  // one that failed, was killed or cannot be addressed is done for good.
  if ((info.status === 'completed' || info.status === 'idle') && info.name) {
    return 'sleeping'
  }

  return 'closed'
}

function elapsed(from: number, to: number): string {
  const total = Math.max(0, Math.floor((to - from) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')

  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}

function catSvg(color: string, isAsleep: boolean): string {
  const eyes = isAsleep
    ? '<path d="M9 17 q2 2 4 0 M19 17 q2 2 4 0" stroke="#333" stroke-width="1.2" fill="none"/>'
    : '<circle cx="11" cy="17" r="1.8" fill="#333"/><circle cx="21" cy="17" r="1.8" fill="#333"/>'

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28">' +
    `<path d="M5 14 L7 3 L14 9 Z M27 14 L25 3 L18 9 Z" fill="${color}" stroke="#333" stroke-width="1"/>` +
    `<ellipse cx="16" cy="19" rx="12" ry="10" fill="${color}" stroke="#333" stroke-width="1"/>` +
    eyes +
    '<path d="M15 21 L17 21 L16 22.4 Z" fill="#E88"/>' +
    '<path d="M3 20 L10 21 M3 23 L10 22 M29 20 L22 21 M29 23 L22 22" stroke="#555" stroke-width="0.6"/>' +
    '</svg>'
  )
}

function toQuestions(raw: readonly unknown[]): CatQuestion[] {
  return raw.map(item => {
    const q = item as {
      question?: string
      header?: string
      kind?: string
      multiSelect?: boolean
      options?: { label?: string }[]
    }
    const kind = q.kind === 'text' || q.kind === 'number' ? q.kind : 'choice'

    return {
      question: q.question ?? '',
      header: q.header ?? '',
      kind,
      isMulti: q.multiSelect === true,
      options: (q.options ?? []).map(o => o.label ?? '').filter(Boolean),
    }
  })
}

function answerOf(p: CatPending, index: number): string {
  const picked = p.picks[index] ?? []
  const other = (p.others[index] ?? '').trim()

  return [...picked, ...(other ? [other] : [])].join(', ')
}

function describeInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    for (const key of ['command', 'file_path', 'url', 'path', 'pattern', 'description', 'prompt']) {
      if (typeof o[key] === 'string') {
        return String(o[key]).slice(0, 300)
      }
    }
  }

  return ''
}

async function meow($: EngineInterface, text: string): Promise<void> {
  $.ui.toast(`🐱 喵！${text}`)
  try {
    await $.audio.play({ asset: 'sounds/meow.wav' })
  } catch (error) {
    $.ui.log(`agent-cats: could not play the meow (${String(error)})`, { to: 'debug' })
  }
}

// Every write redraws the pane (an open dropdown jumps back to its top), so
// the agents are written only when the change actually changed something.
async function changeAgents($: EngineInterface, change: (rows: CatAgent[]) => CatAgent[]): Promise<void> {
  const ref = { plugin: 'agent-cats', key: 'agents' } as const
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { value = [], version } = await $.state.get(ref)
    const next = change(value)
    if (JSON.stringify(next) === JSON.stringify(value)) {
      return
    }
    wrote('agents')
    const { isSet } = await $.state.set(ref, next, { ifVersion: version })
    if (isSet) {
      return
    }
  }
}

async function setMain($: EngineInterface, change: (row: CatAgent) => CatAgent): Promise<void> {
  await changeAgents($, rows => {
    const list = rows ?? []
    const main =
      list.find(r => r.id === MAIN) ??
      ({
        id: MAIN,
        label: '主 agent',
        type: 'main',
        status: 'sleeping',
        rawStatus: 'idle',
        color: MAIN_COLOR,
        startedAt: 0,
        skills: [],
      } satisfies CatAgent)

    return [change(main), ...list.filter(r => r.id !== MAIN)]
  })
}

async function patchAgent($: EngineInterface, id: string, change: (row: CatAgent) => CatAgent): Promise<void> {
  if (id === MAIN) {
    return setMain($, change)
  }
  await changeAgents($, rows => rows.map(r => (r.id === id ? change(r) : r)))
}

// The installed skills: the context listing (counted locally, no API call)
// where the host computes it, plus the plugin and user slash commands, which
// is where skills show up when it does not. Answers a line for diagnostics.
async function loadSkills($: EngineInterface): Promise<string> {
  let fromContext: string[] = []
  let contextNote = 'ok'
  try {
    const usage = await $.session.usage({ breakdown: 'summary' })
    const breakdown = usage.context.breakdown
    fromContext = (breakdown?.skills?.skillFrontmatter ?? []).map(s => s.name)
    if (!breakdown) {
      contextNote = 'no breakdown'
    } else if (!breakdown.skills) {
      contextNote = 'no skills in breakdown'
    }
  } catch (error) {
    contextNote = `error: ${String(error)}`
  }
  let fromCommands: string[] = []
  let commandNote = 'ok'
  try {
    fromCommands = (await $.command.list())
      .filter(c => (c.source === 'plugin' || c.source === 'user') && c.name !== 'cats')
      .map(c => c.name)
  } catch (error) {
    commandNote = `error: ${String(error)}`
  }
  const names = [...new Set([...fromContext, ...fromCommands])].sort((a, b) => a.localeCompare(b))
  if (JSON.stringify(names) !== JSON.stringify(await read($, skills))) {
    await $.state.set({ plugin: 'agent-cats', key: 'skills' }, names)
  }

  return `skills: ${names.length} (context listing ${fromContext.length}, ${contextNote}; commands ${fromCommands.length}, ${commandNote})`
}

function skillNote(active: readonly string[], mode: SkillMode): string {
  const list = active.join(', ')

  return mode === 'only'
    ? `The user chose the skills for this task in the Agent Cats dashboard: ${list}. Use only these skills (load each with the Skill tool when it applies); any other skill is refused.`
    : `The user chose the skills for this task in the Agent Cats dashboard: ${list}. Prefer these skills and load each with the Skill tool when it applies.`
}

// Hands one installed skill to one cat: a running loop reads it at its next
// step, a sleeping subagent is woken with it, an idle main agent gets a prompt.
async function giveSkill($: EngineInterface, row: CatAgent, skill: string): Promise<void> {
  const ask = `The user asks you, from the Agent Cats dashboard, to load the skill "${skill}" with the Skill tool now and use it for your current task.`
  if (row.status === 'working') {
    await $.session.append({
      message: { type: 'user', content: [{ type: 'text', text: ask }] },
      ...(row.id === MAIN ? {} : { agentId: row.id }),
    })
  } else if (row.id === MAIN) {
    await $.prompt.submit({ text: ask })
  } else if (row.name) {
    await $.prompt.submit({
      text: `Use SendMessage to wake the agent "${row.name}" (${row.label}) and tell it to load the skill "${skill}" with the Skill tool and use it to continue its task.`,
    })
  } else {
    $.ui.toast(`🐱 ${row.nickname || row.label} 已經結束，交唔到 skill`)

    return
  }
  $.ui.toast(`🐱 已經叫「${row.nickname || row.label}」用 ${skill}`)
}

async function sync($: EngineInterface): Promise<void> {
  // The person is in a picker: nothing redraws under them; the next tick
  // after the hold catches up (end times are then a second or so late).
  if (await isHolding($)) {
    return
  }
  const list = await $.agent.list()
  const now = await $.clock.now()

  await changeAgents($, current => {
    let changed = false
    const next = current.map(row => {
      const info = list.find(a => a.id === row.id)
      if (!info) {
        return row
      }
      const status = catStatusOf(info)
      if (status === row.status && info.status === row.rawStatus && info.name === row.name) {
        return row
      }
      changed = true
      const isWoken = status === 'working' && row.status !== 'working'

      return {
        ...row,
        status,
        rawStatus: info.status,
        name: info.name,
        label: info.description || row.label,
        startedAt: isWoken ? now : row.startedAt,
        endedAt: status === 'working' ? undefined : (row.endedAt ?? now),
        tool: status === 'working' ? row.tool : undefined,
        isHidden: isWoken ? false : row.isHidden,
      }
    })
    const known = new Set(current.map(r => r.id))
    const added = list
      .filter(a => !known.has(a.id))
      .map((a, i): CatAgent => {
        const status = catStatusOf(a)

        return {
          id: a.id,
          label: a.description || a.type,
          type: a.type,
          name: a.name,
          status,
          rawStatus: a.status,
          color: PALETTE[(current.length - 1 + i + PALETTE.length) % PALETTE.length] ?? MAIN_COLOR,
          startedAt: now,
          endedAt: status === 'working' ? undefined : now,
          skills: [],
        }
      })

    return changed || added.length > 0 ? [...next, ...added] : current
  })

  const rows = await read($, agents)
  const waits = await read($, pending)
  if (rows.some(r => r.status === 'working') || waits.length > 0) {
    wrote('now')
    await $.state.set({ plugin: 'agent-cats', key: 'now' }, now)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await setMain($, row => row)
    $.ui.log(`agent-cats: ${await loadSkills($)}`, { to: 'debug' })
    await $.command.register({ name: 'cats', description: 'Open the Agent 貓貓 dashboard' })
    void $.ui.open({ id: PANE, title: TITLE })
    $.clock.every(1000, () => {
      void sync($)
    })

    return next(e)
  })

  on('ui.focus', { requestId: PANE }, async ($, e, next) => {
    // The person's move names the element; a plugin's `$.ui.focus` call, its `key`.
    const element = e.element ?? (e as { key?: string }).key
    holdUntil = element && HOLD_ELEMENT.test(element) ? (await $.clock.now()) + HOLD_MS : 0
    focusSeen.push(element ?? '(none)')
    focusSeen.splice(0, Math.max(0, focusSeen.length - 3))

    return next(e)
  })

  on('command.run', { command: 'cats' }, async $ => {
    const found = await loadSkills($)
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    const focus = focusSeen.length > 0 ? focusSeen.join(', ') : 'none'

    return { text: `Agent 貓貓 dashboard opened. ${found}; draws ${renders}; writes ${JSON.stringify(writes)}; last focus ${focus}` }
  })

  // The skills chosen in the dashboard ride along with every prompt and spawn.
  on('prompt.submit', async ($, e, next) => {
    const active = await read($, activeSkills)
    if (active.length === 0) {
      return next(e)
    }
    const note = skillNote(active, await read($, skillMode))

    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  on('agent.spawn', async ($, e, next) => {
    const active = await read($, activeSkills)
    if (active.length === 0) {
      return next(e)
    }

    return next({ ...e, prompt: `${skillNote(active, await read($, skillMode))}\n\n${e.prompt}` })
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    const text = e.text.trim().replace(/\s+/g, ' ')
    await setMain($, row => ({
      ...row,
      status: 'working',
      rawStatus: 'running',
      label: text ? text.slice(0, 60) : row.label,
      startedAt: now,
      endedAt: undefined,
      skills: [],
    }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await setMain($, row => ({ ...row, status: 'sleeping', rawStatus: 'idle', endedAt: now, tool: undefined }))
    }

    return next(e)
  })

  // Every tool call: what each cat is doing now, the skills it used, and the
  // permission questions it raised that the call has now settled.
  on('tool.call', async ($, e, next) => {
    const who = e.agentId ?? MAIN
    // Read the arguments as untyped: how the engine types a built-in tool's
    // input depends on the build that wrote the declarations.
    const args = e as { skill?: unknown }
    const skill = e.tool === 'Skill' && typeof args.skill === 'string' ? args.skill : undefined
    if (skill !== undefined && (await read($, skillMode)) === 'only') {
      const active = await read($, activeSkills)
      if (active.length > 0 && !active.includes(skill)) {
        return {
          deny: `The user allowed only these skills in the Agent Cats dashboard: ${active.join(', ')}. "${skill}" is switched off.`,
        }
      }
    }
    // The "用緊 X" line waits while the person is in a picker; a skill is kept.
    const showsTool = !(await isHolding($))
    await patchAgent($, who, row => ({
      ...row,
      tool: showsTool ? e.tool : row.tool,
      skills: skill && !row.skills.includes(skill) ? [...row.skills, skill] : row.skills,
    }))
    try {
      return await next(e)
    } finally {
      if (!(await isHolding($))) {
        await patchAgent($, who, row => (row.tool === e.tool ? { ...row, tool: undefined } : row))
      }
      await update($, pending, list =>
        (list ?? []).filter(p => !(p.kind === 'permission' && p.agentId === who && p.tool === e.tool)),
      )
    }
  })

  // A question to the person: answered in the dashboard. The engine's dialog
  // waits beneath (its site drawn as a pointer here) and wins if used instead.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const id = e.tool_use_id
    const raw = (e as { questions?: unknown }).questions
    const questions = toQuestions(Array.isArray(raw) ? raw : [])
    const answered = new Promise<Answers>(resolve => {
      resolvers.set(id, resolve)
    })
    const item: CatPending = {
      id,
      kind: 'question',
      agentId: e.agentId ?? MAIN,
      askedAt: await $.clock.now(),
      questions,
      picks: questions.map(() => []),
      others: questions.map(() => ''),
    }
    await update($, pending, list => [...(list ?? []), item])
    void $.ui.open({ id: PANE, title: TITLE, focus: true })
    void meow($, '有 agent 問你問題，喺 Agent 貓貓 dashboard 答')

    try {
      const won = await Promise.race([
        next(e).then(result => ({ result })),
        answered.then(answers => ({ answers })),
      ])
      if ('result' in won) {
        return won.result
      }

      return { result: { questions: raw, answers: won.answers } as never }
    } finally {
      resolvers.delete(id)
      await update($, pending, list => (list ?? []).filter(p => p.id !== id))
      await update($, native, list => (list ?? []).filter(n => n !== id))
    }
  })

  // A permission prompt: shown with its meow; the engine's own dialog answers it.
  on('classic.PermissionRequest', async ($, e, next) => {
    const item: CatPending = {
      id: `perm-${await $.clock.now()}-${e.tool_name}`,
      kind: 'permission',
      agentId: e.agent_id ?? MAIN,
      askedAt: await $.clock.now(),
      questions: [],
      picks: [],
      others: [],
      tool: e.tool_name,
      detail: describeInput(e.tool_input),
    }
    await update($, pending, list => [...(list ?? []), item])
    void $.ui.open({ id: PANE, title: TITLE })
    void meow($, `有 agent 想用 ${e.tool_name}，等你批准`)

    return next(e)
  })

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const useNative = (await read($, native)).includes(e.requestId)
    if (useNative || !resolvers.has(e.requestId)) {
      return next(e)
    }
    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={1}>
        <Text color={MAIN_COLOR}>ᓚᘏᗢ</Text>
        <Text>呢條問題請喺「{TITLE}」dashboard 回答。</Text>
        <Button
          key={`native-${e.requestId}`}
          label="喺呢度答"
          plain
          onPress={() => update($, native, list => [...(list ?? []), e.requestId])}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    renders += 1
    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const Svg = 'Svg' in table ? table.Svg : undefined
    const Input = 'Input' in table ? table.Input : undefined
    const Select = 'Select' in table ? table.Select : undefined
    const installed = await read($, skills)
    const active = await read($, activeSkills)
    const mode = await read($, skillMode)
    const filter = await read($, skillFilter)
    const editing = await read($, renaming)
    const rows = await read($, agents)
    const waits = await read($, pending)
    const now = Math.max(await read($, clockNow), ...rows.map(r => r.endedAt ?? r.startedAt))
    const nativeIds = await read($, native)
    const byId = (id: string) => rows.find(r => r.id === id)

    const cat = (color: string, isAsleep: boolean, key: string) =>
      Svg ? (
        <Svg key={key} source={catSvg(color, isAsleep)} alt={isAsleep ? 'sleeping cat' : 'cat'} width={28} height={28} />
      ) : (
        <Text color={color}>{isAsleep ? 'ᓚᘏᗢᶻ' : 'ᓚᘏᗢ'}</Text>
      )

    const setPending = (id: string, change: (p: CatPending) => CatPending) =>
      update($, pending, list => (list ?? []).map(p => (p.id === id ? change(p) : p)))

    const pick = (p: CatPending, index: number, label: string) =>
      setPending(p.id, cur => {
        const q = cur.questions[index]
        const had = cur.picks[index] ?? []
        const chosen = q?.isMulti
          ? had.includes(label)
            ? had.filter(l => l !== label)
            : [...had, label]
          : [label]
        const others = q?.isMulti ? cur.others : cur.others.map((o, i) => (i === index ? '' : o))

        return { ...cur, picks: cur.picks.map((l, i) => (i === index ? chosen : l)), others }
      })

    const typeOther = (p: CatPending, index: number, text: string) =>
      setPending(p.id, cur => {
        const isMulti = cur.questions[index]?.isMulti
        const picks = isMulti ? cur.picks : cur.picks.map((l, i) => (i === index ? [] : l))

        return { ...cur, picks, others: cur.others.map((o, i) => (i === index ? text : o)) }
      })

    const send = (p: CatPending) => {
      const answers: Answers = {}
      p.questions.forEach((q, i) => {
        answers[q.question] = answerOf(p, i)
      })
      resolvers.get(p.id)?.(answers)
    }

    const working = rows.filter(r => r.status === 'working').length
    const sleeping = rows.filter(r => r.status === 'sleeping').length
    const visible = rows.filter(r => !r.isHidden)
    const hiddenClosed = rows.some(r => r.status === 'closed' && !r.isHidden)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={2}>
          <Text bold>🐾 {TITLE}</Text>
          <Text color={STATUS_COLOR.working}>工作中 {working}</Text>
          <Text color={STATUS_COLOR.sleeping}>休眠 {sleeping}</Text>
          <Text color={waits.length > 0 ? '#E76F51' : '#888888'}>等你回覆 {waits.length}</Text>
        </Box>

        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#4D96FF" paddingX={1}>
          <Box flexDirection="row" gap={2} alignItems="center" flexWrap="wrap">
            <Text bold color="#4D96FF">今次任務用嘅 skills</Text>
            <Button
              key="skill-mode"
              label={mode === 'only' ? '模式：只准用揀咗嘅' : '模式：優先用揀咗嘅'}
              variant={mode === 'only' ? 'primary' : 'secondary'}
              onPress={() => update($, skillMode, m => (m === 'only' ? 'prefer' : 'only'))}
            />
            <Button
              key="skills-reload"
              label="重新整理清單"
              plain
              onPress={async () => {
                $.ui.toast(`🐱 ${await loadSkills($)}`)
              }}
            />
          </Box>
          {active.length === 0 ? (
            <Text dimColor>未揀（全部 skills 照常可用）</Text>
          ) : (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              {active.map(name => (
                <Button
                  key={`active-${name}`}
                  label={`${name} ✕`}
                  onPress={() => update($, activeSkills, list => (list ?? []).filter(n => n !== name))}
                />
              ))}
              <Button key="active-clear" label="全部清除" plain onPress={() => update($, activeSkills, () => [])} />
            </Box>
          )}
          {Input && installed.length > MAX_SKILL_OPTIONS && (
            <Input
              key="skill-filter"
              placeholder={`篩選 skill（共 ${installed.length} 個），打關鍵字再 Enter`}
              value={filter}
              submitLabel="篩選"
              onSubmit={value => update($, skillFilter, () => value)}
            />
          )}
          {Select && installed.length > 0 && (
            <Select
              key="active-add"
              label="加入 skill："
              value={PICK_HINT}
              options={skillOptions(
                installed.filter(n => !active.includes(n)),
                filter,
                '— 揀一個已安裝嘅 skill —',
              )}
              onSelect={value => {
                if (value !== PICK_HINT) {
                  void update($, activeSkills, list => [...new Set([...(list ?? []), value])])
                }
              }}
            />
          )}
          {installed.length === 0 && <Text dimColor>搵唔到已安裝嘅 skills，試吓撳「重新整理清單」。</Text>}
          {Input && (
            <Input
              key="skill-search"
              placeholder="搵新 skill：講你想做乜，Enter 叫主 agent 去搵"
              submitLabel="搵"
              onSubmit={value => {
                const need = value.trim()
                if (need) {
                  void $.prompt.submit({
                    text:
                      `From the Agent Cats dashboard, the user wants a new skill for: "${need}". ` +
                      'Search the skill and plugin catalogs (SearchSkills, SearchPlugins), then show the fitting results ' +
                      'as install cards (SuggestSkills, SuggestPluginInstall) so the user approves the install. Do not install anything yourself.',
                  })
                  $.ui.toast('🐱 已經叫主 agent 去搵 skill')
                }
              }}
            />
          )}
        </Box>

        {waits.length > 0 && (
          <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#E76F51" paddingX={1}>
            <Text bold color="#E76F51">需要你回覆</Text>
            {waits.map(p => {
              const who = byId(p.agentId)
              const color = who?.color ?? MAIN_COLOR
              const name = who?.nickname || who?.label || p.agentId
              const head = (
                <Box flexDirection="row" gap={1} alignItems="center">
                  {cat(color, false, `ask-cat-${p.id}`)}
                  <Text bold>{name}</Text>
                  <Text dimColor>等咗 {elapsed(p.askedAt, now)}</Text>
                </Box>
              )

              if (p.kind === 'permission') {
                return (
                  <Box key={`wait-${p.id}`} flexDirection="column">
                    {head}
                    <Text>想用 {p.tool}{p.detail ? `：${p.detail}` : ''}</Text>
                    <Text dimColor>請喺權限對話框揀 Allow / Deny（權限只可以由原生對話框批准）。</Text>
                  </Box>
                )
              }

              const isOrphan = !resolvers.has(p.id)
              const isNative = nativeIds.includes(p.id)
              const isReady = p.questions.every((_, i) => answerOf(p, i) !== '')

              return (
                <Box key={`wait-${p.id}`} flexDirection="column" gap={1}>
                  {head}
                  {p.questions.map((q, i) => (
                    <Box key={`q-${p.id}-${i}`} flexDirection="column">
                      <Text>
                        {q.header ? `[${q.header}] ` : ''}
                        {q.question}
                      </Text>
                      {q.kind === 'choice' && (
                        <Box flexDirection="row" flexWrap="wrap" gap={1}>
                          {q.options.map((label, j) => (
                            <Button
                              key={`opt-${p.id}-${i}-${j}`}
                              label={`${(p.picks[i] ?? []).includes(label) ? '✓ ' : ''}${label}`}
                              variant={(p.picks[i] ?? []).includes(label) ? 'primary' : 'secondary'}
                              onPress={() => pick(p, i, label)}
                            />
                          ))}
                        </Box>
                      )}
                      {Input && (
                        <Input
                          key={`other-${p.id}-${i}`}
                          placeholder={q.kind === 'choice' ? '其他（自己打，Enter 確認）' : '你嘅答案（Enter 確認）'}
                          value={p.others[i] ?? ''}
                          submitLabel="確認"
                          onSubmit={value => typeOther(p, i, value)}
                        />
                      )}
                    </Box>
                  ))}
                  {isOrphan || isNative ? (
                    <Text dimColor>請喺原生對話框回答。</Text>
                  ) : (
                    <Box flexDirection="row" gap={1}>
                      <Button
                        key={`send-${p.id}`}
                        label={isReady ? '送出答案' : '送出答案（未答晒）'}
                        variant="primary"
                        dimColor={!isReady}
                        onPress={() => {
                          if (isReady) {
                            send(p)
                          }
                        }}
                      />
                      <Button
                        key={`use-native-${p.id}`}
                        label="改用原生對話框"
                        onPress={() => update($, native, list => [...(list ?? []), p.id])}
                      />
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        )}

        {visible.length === 0 && <Text dimColor>未有 agent。</Text>}
        {visible.map(r => (
          <Box key={`agent-${r.id}`} flexDirection="column" borderStyle="round" borderColor={r.color} paddingX={1}>
            <Box flexDirection="row" gap={1} alignItems="center">
              {cat(r.color, r.status !== 'working', `cat-${r.id}`)}
              <Text bold wrap="truncate-end">
                {r.nickname || r.label}
              </Text>
              {editing !== r.id && (
                <Button key={`rename-btn-${r.id}`} label="✎ 改名" plain onPress={() => update($, renaming, () => r.id)} />
              )}
            </Box>
            {r.nickname && <Text dimColor wrap="truncate-end">任務：{r.label}</Text>}
            {Input && editing === r.id && (
              <Box flexDirection="row" gap={1}>
                <Input
                  key={`rename-${r.id}`}
                  placeholder="新名（留空就用返原本嘅任務名）"
                  value={r.nickname ?? ''}
                  submitLabel="改名"
                  autoFocus
                  onSubmit={value => {
                    const nickname = value.trim().slice(0, 40)
                    void patchAgent($, r.id, row => ({ ...row, nickname: nickname || undefined }))
                    void update($, renaming, () => '')
                  }}
                />
                <Button key={`rename-cancel-${r.id}`} label="取消" plain onPress={() => update($, renaming, () => '')} />
              </Box>
            )}
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              <Text color={STATUS_COLOR[r.status]}>{STATUS_TEXT[r.status]}</Text>
              <Text dimColor>⏱ {r.startedAt ? elapsed(r.startedAt, r.endedAt ?? now) : '--:--'}</Text>
              <Text dimColor>{r.type}</Text>
              {r.tool && <Text color="#4D96FF">用緊 {r.tool}</Text>}
            </Box>
            <Text dimColor={r.skills.length === 0}>Skills：{r.skills.length > 0 ? r.skills.join('、') : '未用'}</Text>
            {Select && r.status !== 'closed' && installed.length > 0 && (
              <Select
                key={`give-${r.id}`}
                label="＋Skill："
                value={PICK_HINT}
                options={skillOptions(installed, filter, '— 交一個 skill 俾佢 —')}
                onSelect={value => {
                  if (value !== PICK_HINT) {
                    void giveSkill($, r, value)
                  }
                }}
              />
            )}
            {r.status === 'sleeping' && r.id !== MAIN && (
              <Box flexDirection="column">
                {Input && r.name && (
                  <Input
                    key={`wake-${r.id}`}
                    placeholder="交代新工作，Enter 喚醒佢"
                    submitLabel="喚醒"
                    onSubmit={value => {
                      const task = value.trim()
                      if (task && r.name) {
                        void $.prompt.submit({
                          text: `Use SendMessage to wake the agent "${r.name}" (${r.label}) and give it this follow-up task: ${task}`,
                        })
                      }
                    }}
                  />
                )}
                <Button
                  key={`close-${r.id}`}
                  label="唔使再喚醒，關閉佢"
                  plain
                  onPress={() =>
                    patchAgent($, r.id, row => ({ ...row, status: 'closed', isHidden: true }))
                  }
                />
              </Box>
            )}
          </Box>
        ))}
        {hiddenClosed && (
          <Button
            key="clear-closed"
            label="收埋已結束嘅貓"
            plain
            onPress={() =>
              update($, agents, list => (list ?? []).map(r => (r.status === 'closed' ? { ...r, isHidden: true } : r)))
            }
          />
        )}
      </Box>
    )
  })
}
