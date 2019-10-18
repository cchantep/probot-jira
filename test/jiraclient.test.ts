import * as option from 'fp-ts/lib/Option'

import nock from 'nock'

import * as j from '../src/jira/client'
import { HookSettings } from '../src/model/jira'

// Fixtures
import jiraIssue1 from './fixtures/jira-issue1.json'
import jiraHooks1 from './fixtures/jira-hooks1.json'

import * as jf from './fixtures/jiraissue'
import * as jh from './fixtures/jirahooks'

nock.disableNetConnect()

describe('JIRA client', () => {
  const nockBaseUrl1 = 'https://bar%40lorem.net:123abc@foo.atlassian.net'
  const scope1 = nock(nockBaseUrl1).defaultReplyHeaders({
    'access-control-allow-origin': '*',
  })

  const nockBaseUrl2 = 'https://foo.atlassian.net'
  const scope2 = nock(nockBaseUrl2)
    .matchHeader('authorization', 'Basic YmFyQGxvcmVtLm5ldDoxMjNhYmM=')
    .defaultReplyHeaders({
      'access-control-allow-origin': '*',
    })

  const credentials: j.Credentials = {
    domain: 'foo.atlassian.net',
    username: 'bar@lorem.net',
    apiToken: '123abc',
  }

  // ---

  scope1.get('/rest/api/latest/issue/NO_ISSUE').reply(404, {
    errorMessages: ['Issue does not exist or you do not have permission to see it.'],
    errors: {},
  })

  test('must not find issue for invalid ref', async () => {
    const res = await j.getIssue(credentials, 'NO_ISSUE')

    expect(option.isNone(res)).toEqual(true)
  })

  // ---

  const issueRef = 'PRJ-123'

  scope1.get(`/rest/api/latest/issue/${issueRef}`).reply(200, jiraIssue1)

  test(`must find issue ${issueRef}`, async () => {
    const res = await j.getIssue(credentials, issueRef)

    expect(option.toUndefined(res)).toEqual(jf.issue1)
  })

  // ---

  scope1.get('/rest/webhooks/latest/webhook').reply(200, jiraHooks1)

  test('must list the hooks', async () => {
    const res = await j.getHooks(credentials)

    expect(res).toEqual(jh.hooks1)
  })

  // ---

  scope1.get('/rest/webhooks/latest/webhook/1').reply(200, jiraHooks1[0])

  test('must get a hook by ID', async () => {
    const res = await j.getHook(credentials, '1')

    expect(option.toUndefined(res)).toEqual(jh.hooks1[0])
  })

  // ---

  scope2
    .post(
      '/rest/webhooks/latest/webhook/',
      HookSettings.encode({
        name: jiraHooks1[1].name,
        url: jiraHooks1[1].url,
        filters: jiraHooks1[1].filters,
        events: jiraHooks1[1].events,
        enabled: jiraHooks1[1].enabled,
      }),
    )
    .reply(200)

  test('must register a hook', async () => {
    const res = await j.registerHook(credentials, jiraHooks1[1])

    expect(res).toEqual({
      _tag: 'Right',
      value: void 0,
    })
  })
})
