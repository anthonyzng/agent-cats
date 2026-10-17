import { mock, test, expect } from 'claude-code/testing'

// The test kit's environment has a console; the declarations name no DOM.
declare const console: { log: (...values: unknown[]) => void }

const PANE_PROPS = {
  title: 'Agent Cats',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, height: 60 },
  view: { rows: 60 },
} as never

type Info = { id: string; description: string; type: string; status: string; name?: string }

// The engine as the dashboard sees it: an agent list the test changes, a held
// audio player, and a record of the stops and plays.
function engine(on: any, list: { value: Info[] }, os?: string) {
  const clock = mock.clock(on)
  const plays: string[] = []
  const runs: { argv: string[]; clip: string }[] = []
  const stops: string[] = []
  const aborts: string[] = []
  const toasts: string[] = []
  let release: () => void = () => {}
  on('command.list', () => ({ value: [{ name: 'tidy', description: 'd', source: 'plugin' }] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  on('agent.list', () => ({ value: list.value }))
  on('command.register', () => ({ value: { isRegistered: true } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_$: any, e: any) => {
    toasts.push(String(e.text ?? e))
    return { value: undefined }
  })
  on('ui.focus', () => ({}))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.abort', (_$: any, e: any) => {
    aborts.push(e.turnId)
    return { value: undefined }
  })
  on('audio.play', (_$: any, e: any) => {
    plays.push(String(e.asset ?? e.clip?.asset ?? 'clip'))
    return new Promise(resolve => {
      release = () => resolve({ value: undefined })
    })
  })
  on('env.get', (_$: any, e: any) => ({ value: e.name === 'OS' ? os : undefined }))
  on('process.run', (_$: any, e: any) => {
    runs.push({ argv: [...e.argv], clip: e.init?.env?.AGENT_CATS_CLIP ?? '' })
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('tool.call', (_$: any, e: any) => {
    if (e.tool === 'TaskStop') {
      stops.push(e.task_id)
    }
    return { result: 'ok', text: 'ok' }
  })

  return { clock, plays, runs, stops, aborts, toasts, done: () => release() }
}

async function mountPane($: any, surface: 'desktop' | 'terminal') {
  return $.ui.mount({
    plugin: 'agent-cats',
    surface,
    component: 'Pane',
    requestId: 'agent-cats',
    props: PANE_PROPS,
    viewport: { columns: 100, rows: 60 },
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`${surface}: the view buttons list only working, asleep or waiting cats`, async ($: any, on: any) => {
    const list = {
      value: [
        { id: 'a1', description: 'busy task', type: 'Explore', status: 'running', name: 'cat-a' },
        { id: 'a2', description: 'nap task', type: 'Explore', status: 'completed', name: 'cat-b' },
      ],
    }
    const eng = engine(on, list)
    await $.session.start({ source: 'startup', cwd: '.' })
    await eng.clock.advance(1500)
    const ui = await mountPane($, surface)

    expect(await ui.find({ key: 'agent-a1' })).toBeTruthy()
    expect(await ui.find({ key: 'agent-a2' })).toBeTruthy()
    await ui.press({ key: 'view-working' })
    expect(await ui.find({ key: 'agent-a1' })).toBeTruthy()
    expect(await ui.find({ key: 'agent-a2' })).toBeFalsy()
    await ui.press({ key: 'view-sleeping' })
    expect(await ui.find({ key: 'agent-a1' })).toBeFalsy()
    expect(await ui.find({ key: 'agent-a2' })).toBeTruthy()
    await ui.press({ key: 'view-waiting' })
    expect(await ui.find({ key: 'agent-a1' })).toBeFalsy()
    expect(await ui.find({ key: 'agent-a2' })).toBeFalsy()
    // Pressing the chosen view again goes back to all.
    await ui.press({ key: 'view-waiting' })
    expect(await ui.find({ key: 'agent-a1' })).toBeTruthy()
    expect(await ui.find({ key: 'agent-a2' })).toBeTruthy()
    await ui.unmount()
  })

  test(`${surface}: Stop asks first, then stops the subagent with TaskStop`, async ($: any, on: any) => {
    const list = { value: [{ id: 'a1', description: 'busy task', type: 'Explore', status: 'running', name: 'cat-a' }] }
    const eng = engine(on, list)
    await $.session.start({ source: 'startup', cwd: '.' })
    await eng.clock.advance(1500)
    const ui = await mountPane($, surface)

    await ui.press({ key: 'stop-a1' })
    expect(eng.stops).toEqual([])
    expect(await ui.find({ key: 'stop-yes-a1' })).toBeTruthy()
    await ui.press({ key: 'stop-no-a1' })
    expect(eng.stops).toEqual([])
    expect(await ui.find({ key: 'stop-yes-a1' })).toBeFalsy()

    await ui.press({ key: 'stop-a1' })
    await ui.press({ key: 'stop-yes-a1' })
    expect(eng.stops).toEqual(['a1'])

    // The stopped cat keeps its skill picker, and its end is not chimed as a finished task.
    list.value = [{ id: 'a1', description: 'busy task', type: 'Explore', status: 'killed', name: 'cat-a' }]
    await eng.clock.advance(1500)
    expect(await ui.find({ key: 'give-a1' })).toBeTruthy()
    expect(eng.plays).toEqual([])
    await ui.unmount()
  })
}

test('Stop on the main agent aborts its running turn', async ($: any, on: any) => {
  const eng = engine(on, { value: [] })
  await $.session.start({ source: 'startup', cwd: '.' })
  await $.turn.start({ text: 'long work', turnId: 't-main' })
  const ui = await mountPane($, 'desktop')
  await ui.press({ key: 'stop-main' })
  await ui.press({ key: 'stop-yes-main' })
  expect(eng.aborts).toEqual(['t-main'])
  await ui.unmount()
})

test('a deleted cat is gone and stays gone while the engine still lists it', async ($: any, on: any) => {
  const list = { value: [{ id: 'a2', description: 'nap task', type: 'Explore', status: 'completed', name: 'cat-b' }] }
  const eng = engine(on, list)
  await $.session.start({ source: 'startup', cwd: '.' })
  await eng.clock.advance(1500)
  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ key: 'delete-main' })).toBeFalsy()
  await ui.press({ key: 'delete-a2' })
  expect(await ui.find({ key: 'agent-a2' })).toBeFalsy()
  await eng.clock.advance(5000)
  expect(await ui.find({ key: 'agent-a2' })).toBeFalsy()
  await ui.unmount()
})

test('finishing agents chime once at a time: no overlap, no queue', async ($: any, on: any) => {
  const list = {
    value: [
      { id: 'a1', description: 'one', type: 'Explore', status: 'running', name: 'cat-a' },
      { id: 'a2', description: 'two', type: 'Explore', status: 'running', name: 'cat-b' },
      { id: 'a3', description: 'three', type: 'Explore', status: 'running', name: 'cat-c' },
    ],
  }
  const eng = engine(on, list)
  await $.session.start({ source: 'startup', cwd: '.' })
  await eng.clock.advance(1500)

  // Two finish in the same tick: one play.
  list.value = list.value.map(a => (a.id === 'a3' ? a : { ...a, status: 'completed' }))
  await eng.clock.advance(1500)
  expect(eng.plays).toEqual(['sounds/Hachimi.mp3'])

  // A third finishes while the clip still plays: dropped, not queued.
  list.value = list.value.map(a => ({ ...a, status: 'completed' }))
  await eng.clock.advance(1500)
  expect(eng.plays.length).toBe(1)

  // Once the clip has played through, the next one sounds again.
  eng.done()
  await eng.clock.advance(10)
  await $.turn.start({ text: 'next', turnId: 't2' })
  await $.turn.complete({ answer: 'done', durationMs: 5, reason: 'answer', turnId: 't2' } as never)
  console.log(`plays: ${eng.plays.join(', ')}`)
  expect(eng.plays.length).toBe(2)
})

test('a cat still working can be deleted: confirmed, stopped, then removed', async ($: any, on: any) => {
  const list = { value: [{ id: 'a1', description: 'stuck task', type: 'Explore', status: 'running', name: 'cat-a' }] }
  const eng = engine(on, list)
  await $.session.start({ source: 'startup', cwd: '.' })
  await eng.clock.advance(1500)
  const ui = await mountPane($, 'desktop')

  await ui.press({ key: 'delete-a1' })
  // A working cat asks first: nothing stopped or removed yet.
  expect(eng.stops).toEqual([])
  expect(await ui.find({ key: 'delete-yes-a1' })).toBeTruthy()

  await ui.press({ key: 'delete-yes-a1' })
  expect(eng.stops).toEqual(['a1'])
  expect(await ui.find({ key: 'agent-a1' })).toBeFalsy()
  // The engine still lists it: it does not come back.
  await eng.clock.advance(1500)
  expect(await ui.find({ key: 'agent-a1' })).toBeFalsy()
  await ui.unmount()
})

test('a working subagent the engine no longer lists is closed, not left working', async ($: any, on: any) => {
  const list = { value: [{ id: 'a1', description: 'gone task', type: 'Explore', status: 'running', name: 'cat-a' }] }
  const eng = engine(on, list)
  await $.session.start({ source: 'startup', cwd: '.' })
  await eng.clock.advance(1500)

  const ui = await mountPane($, 'desktop')
  expect(await ui.find({ key: 'stop-a1' })).toBeTruthy()

  list.value = []
  await eng.clock.advance(1500)
  // No Stop left on it, and Delete deletes at once: no confirmation, no TaskStop.
  expect(await ui.find({ key: 'stop-a1' })).toBeFalsy()
  await ui.press({ key: 'delete-a1' })
  expect(eng.stops).toEqual([])
  expect(await ui.find({ key: 'agent-a1' })).toBeFalsy()
  await ui.unmount()
})

test('on Windows the chime is played by PowerShell, not the engine player', async ($: any, on: any) => {
  const list = { value: [{ id: 'a1', description: 'one', type: 'Explore', status: 'running', name: 'cat-a' }] }
  const eng = engine(on, list, 'Windows_NT')
  await $.session.start({ source: 'startup', cwd: '.' })
  await eng.clock.advance(1500)

  list.value = list.value.map(a => ({ ...a, status: 'completed' }))
  await eng.clock.advance(1500)
  expect(eng.plays).toEqual([])
  expect(eng.runs.length).toBe(1)
  const [run] = eng.runs
  expect(run?.argv[0]).toBe('powershell.exe')
  expect(run?.clip.endsWith('/sounds/Hachimi.mp3')).toBe(true)
  // The path rides in the environment, never in the script.
  expect(run?.argv.join(' ').includes('Hachimi')).toBe(false)
})
