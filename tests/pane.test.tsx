import { test } from 'claude-code/testing'

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

const NAMES = Array.from({ length: 90 }, (_, i) => (i % 2 ? `plugin-${i}:skill-${i}` : `skill-${i}`))

test('the dashboard draws with 90 skills', async ($: any, on: any) => {
  on('command.list', () => ({ value: NAMES.map(name => ({ name, description: 'd', source: 'plugin' })) }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }))
  on('agent.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { isRegistered: true } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  try {
    await $.session.start({ source: 'startup', cwd: '.' })
    console.log('session.start ran')
  } catch (error) {
    console.log(`session.start: ${String(error)}`)
  }
  for (const surface of ['desktop', 'terminal'] as const) {
    try {
      const ui = await $.ui.mount({
        plugin: 'agent-cats',
        surface,
        component: 'Pane',
        requestId: 'agent-cats',
        props: PANE_PROPS,
        viewport: { columns: 80, rows: 40 },
      })
      const sel = await ui.find({ key: 'active-add' })
      const give = await ui.find({ key: 'give-main' })
      console.log(`${surface}: drawn; active-add ${sel ? (sel.props.options as unknown[]).length + ' options' : 'MISSING'}; give-main ${give ? 'present' : 'MISSING'}`)
      if (surface === 'desktop') {
        await ui.input({ key: 'skill-filter', text: 'skill-1' })
        const after = await ui.find({ key: 'active-add' })
        console.log(`after filter: ${(after?.props.options as { value: string }[]).map(o => o.value).join(' ')}`)
        await ui.select({ key: 'active-add', value: 'skill-10' })
        console.log(`after pick: ${(await ui.find({ key: 'active-skill-10' })) ? 'chip shown' : 'no chip'}`)
        await ui.press({ key: 'rename-btn-main' })
        console.log(`rename field: ${(await ui.find({ key: 'rename-main' })) ? 'open' : 'MISSING'}`)
        await ui.input({ key: 'rename-main', text: '大貓老闆' })
        const named = await ui.find({ type: 'Text', text: /大貓老闆/ })
        console.log(`after rename: ${named ? named.text : 'name not shown'}; field ${(await ui.find({ key: 'rename-main' })) ? 'still open' : 'closed'}`)
      }
      await ui.unmount()
    } catch (error) {
      console.log(`${surface}: REFUSED ${String(error)}`)
    }
  }
})
