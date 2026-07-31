import { describe, expect, it } from 'vitest'
import { isTrustedTaskResult } from '../src/codexTask.js'

describe('Cowrite task bridge trust boundary', () => {
  it('accepts results only from the authenticated parent origin and request', () => {
    const parent = {} as Window
    const baseEvent = {
      source: parent,
      origin: 'https://codex.example',
      data: {
        type: 'cowrite:send-task-result',
        requestId: 'request-1',
        bridgeToken: 'secret-token',
        ok: true,
      },
    } as Pick<MessageEvent, 'data' | 'origin' | 'source'>

    expect(isTrustedTaskResult(
      baseEvent,
      parent,
      'https://codex.example',
      'request-1',
      'secret-token',
    )).toBe(true)
    expect(isTrustedTaskResult(
      { ...baseEvent, origin: 'https://attacker.example' },
      parent,
      'https://codex.example',
      'request-1',
      'secret-token',
    )).toBe(false)
    expect(isTrustedTaskResult(
      { ...baseEvent, source: {} as Window },
      parent,
      'https://codex.example',
      'request-1',
      'secret-token',
    )).toBe(false)
  })
})
