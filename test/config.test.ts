import { Config, DefaultConfig } from '../src/config'

// Fixtures
import config from '../src/resources/pr-jira.json'

describe('Configuration', () => {
  test('Decode configuration from JSON', () => {
    expect(Config.decode(config)).toEqual({
      _tag: 'Right',
      right: DefaultConfig,
    })
  })
})
