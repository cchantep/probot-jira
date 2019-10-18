import * as t from 'io-ts'

//import { PathReporter } from 'io-ts/lib/PathReporter'

import { Hook, Issue } from '../src/model/jira'

// Fixtures
import jiraIssue1 from './fixtures/jira-issue1.json'
import jiraIssue2 from './fixtures/jira-issue2.json'
import jiraIssue3 from './fixtures/jira-issue3.json'
import jiraIssue4 from './fixtures/jira-issue4.json'

import jiraHooks1 from './fixtures/jira-hooks1.json'

import * as jf from './fixtures/jiraissue'
import * as jh from './fixtures/jirahooks'
import * as jc from './fixtures/jiracallback'

// ---

describe('Validation', () => {
  // --- JIRA issue

  test('Decode JIRA issue #1 from JSON payload', () => {
    const res = Issue.decode(jiraIssue1)

    expect(res).toEqual({
      _tag: 'Right',
      right: jf.issue1,
    })
  })

  test('Decode JIRA issue #2 from JSON payload', () => {
    const res = Issue.decode(jiraIssue2)

    expect(res).toEqual({
      _tag: 'Right',
      right: jf.issue2,
    })
  })

  test('Decode JIRA issue #3 from JSON payload', () => {
    const res = Issue.decode(jiraIssue3)

    expect(res).toEqual({
      _tag: 'Right',
      right: jf.issue3,
    })
  })

  test('Decode JIRA issue #4 from JSON payload', () => {
    const res = Issue.decode(jiraIssue4)

    expect(res).toEqual({
      _tag: 'Right',
      right: jf.issue4,
    })
  })

  // --- JIRA hook

  test('Decode JIRA hooks from JSON payload', () => {
    const res = t.array(Hook).decode(jiraHooks1)

    expect(res).toEqual({
      _tag: 'Right',
      right: jh.hooks1,
    })
  })
})
