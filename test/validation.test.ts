import * as t from 'io-ts'

//import { PathReporter } from 'io-ts/lib/PathReporter'

import { Callback, Hook, Issue, IssueCallback } from '../src/model/jira'

// Fixtures
import jiraIssue1 from './fixtures/jira-issue1.json'
import jiraIssue2 from './fixtures/jira-issue2.json'
import jiraIssue3 from './fixtures/jira-issue3.json'
import jiraIssue4 from './fixtures/jira-issue4.json'

import jiraHooks1 from './fixtures/jira-hooks1.json'

import jiraCallback1 from './fixtures/jira-callback1.json'

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
      value: jf.issue1,
    })
  })

  test('Decode JIRA issue #2 from JSON payload', () => {
    const res = Issue.decode(jiraIssue2)

    expect(res).toEqual({
      _tag: 'Right',
      value: jf.issue2,
    })
  })

  test('Decode JIRA issue #3 from JSON payload', () => {
    const res = Issue.decode(jiraIssue3)

    expect(res).toEqual({
      _tag: 'Right',
      value: jf.issue3,
    })
  })

  test('Decode JIRA issue #4 from JSON payload', () => {
    const res = Issue.decode(jiraIssue4)

    expect(res).toEqual({
      _tag: 'Right',
      value: jf.issue4,
    })
  })

  test('Decode JIRA issue #6 from callback payload', () => {
    const res = Issue.decode(jiraCallback1.payload.issue)

    expect(res).toEqual({
      _tag: 'Right',
      value: jf.issue5,
    })
  })

  // --- JIRA hook

  test('Decode JIRA hooks from JSON payload', () => {
    const res = t.array(Hook).decode(jiraHooks1)

    expect(res).toEqual({
      _tag: 'Right',
      value: jh.hooks1,
    })
  })

  // --- JIRA callback

  test('Decode JIRA callback from JSON payload', () => {
    const res = Callback.decode(jiraCallback1)

    expect(res).toEqual({
      _tag: 'Right',
      value: jc.callback1,
    })
  })

  test('Decode JIRA issue callback from JSON payload', () => {
    const res = IssueCallback.decode(jiraCallback1)

    expect(res).toEqual({
      _tag: 'Right',
      value: jc.issueCallback1,
    })
  })
})
