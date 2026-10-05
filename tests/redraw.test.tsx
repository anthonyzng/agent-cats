import { mock, test, expect } from 'claude-code/testing'

// The test kit's environment has a console; the declarations name no DOM.
declare const console: { log: (...values: unknown[]) => void }


const PANE_PROPS = {
  title: 'Agent 貓貓',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, height: 40 },
  view: { rows: 40 },
} as never

const NAMES = Array.from({ length: 90 }, (_, i) => `skill-${i}`)

async function draws($: any): Promise<number> {
  const { text } = await $.command.run({ command: 'cats' })
  return Number(/draws (\d+)/.exec(text)?.[1] ?? -1)
}

test('the pane stops redrawing while a picker has focus', async ($: any, on: any) => {
  const clock = mock.clock(on)
  on('command.list', () => ({ value: NAMES.map(name => ({ name, description: 'd', source: 'plugin' })) }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'done task', type: 'Explore', status: 'completed', name: 'cat-a' }] }))
  on('command.register', () => ({ value: { isRegistered: true } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('ui.focus', () => ({}))
  await $.session.start({ source: 'startup', cwd: '.' })

  const ui = await $.ui.mount({
    plugin: 'agent-cats',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'agent-cats',
    props: PANE_PROPS,
    viewport: { columns: 80, rows: 40 },
  })
  await clock.advance(3000)

  const idle = await draws($)
  await clock.advance(10_000)
  const idleAfter = await draws($)
  console.log(`idle: ${idle} -> ${idleAfter}`)
  expect(idleAfter).toBe(idle)

  await $.turn.start({ text: 'work', turnId: 't1' })
  await clock.advance(5000)
  const working = await draws($)
  await clock.advance(5000)
  const workingAfter = await draws($)
  console.log(`working: ${working} -> ${workingAfter}`)
  expect(workingAfter).toBeGreaterThan(working)

  await $.ui.focus({ requestId: 'agent-cats', key: 'active-add' })
  const held = await draws($)
  await clock.advance(10_000)
  const heldAfter = await draws($)
  console.log(`picker focused: ${held} -> ${heldAfter}`)
  expect(heldAfter).toBe(held)

  await ui.unmount()
})
