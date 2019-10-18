import { none, some, Option } from 'fp-ts/lib/Option'
import { left, right, Either } from 'fp-ts/lib/Either'
import * as t from 'io-ts'

import axios from 'axios'

import { fromEither } from '../util'
import { Hook, IHook, HookSettings, IHookSettings, Issue, IIssue } from '../model/jira'

export type Credentials = {
  domain: string
  username: string
  apiToken: string
}

export function getIssue(credentials: Credentials, key: string): Promise<Option<IIssue>> {
  const { domain, username, apiToken } = credentials

  return axios({
    method: 'get',
    url: `https://${encodeURIComponent(username)}:${apiToken}@${domain}/rest/api/latest/issue/${key}`,
  }).then(
    resp => {
      return resp.status != 200 ? Promise.resolve(none) : fromEither(Issue.decode(resp.data)).then(issue => some(issue))
    },
    err => {
      if (err.response.status == 404) {
        return Promise.resolve(none)
      } else {
        return Promise.reject(err)
      }
    },
  )
}

const Hooks = t.array(Hook)

export function getHooks(credentials: Credentials): Promise<ReadonlyArray<IHook>> {
  const { domain, username, apiToken } = credentials

  return axios({
    method: 'get',
    url: `https://${encodeURIComponent(username)}:${apiToken}@${domain}/rest/webhooks/latest/webhook`,
  }).then(
    resp => (resp.status != 200 ? Promise.resolve([]) : fromEither(Hooks.decode(resp.data))),
    err => {
      if (err.response.status == 404) {
        return Promise.resolve([])
      } else {
        return Promise.reject(err)
      }
    },
  )
}

export function getHook(credentials: Credentials, id: string): Promise<Option<IHook>> {
  const { domain, username, apiToken } = credentials

  return axios({
    method: 'get',
    url: `https://${encodeURIComponent(username)}:${apiToken}@${domain}/rest/webhooks/latest/webhook/${id}`,
  }).then(
    resp =>
      resp.status != 200 ? Promise.resolve(none) : fromEither(Hook.decode(resp.data)).then(issue => some(issue)),
    err => (err.response.status == 404 ? Promise.resolve(none) : Promise.reject(err)),
  )
}

export function registerHook(credentials: Credentials, hook: IHookSettings): Promise<Either<string, void>> {
  const { domain, username, apiToken } = credentials

  return axios
    .post(
      `https://${encodeURIComponent(username)}:${apiToken}@${domain}/rest/webhooks/latest/webhook/`,
      HookSettings.encode(hook),
    )
    .then(
      resp =>
        resp.status != 200
          ? Promise.resolve(left(`Unexpected status: ${resp.status}`))
          : Promise.resolve(right(void 0)),
      err => Promise.reject(err),
    )
}
