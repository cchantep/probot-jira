import { Context } from 'probot'

import * as t from 'io-ts'
import { none, some, Option } from 'fp-ts/lib/Option'

import * as util from './util'
import { RepoRef } from './model/pullrequest'

// ---

import { GetContentResponse, IGetContentResponse } from './model/content'

function getContent(bot: Context, repo: RepoRef, path: string, ref: string): Promise<IGetContentResponse> {
  return bot.github.repos
    .getContents({ ...repo, path })
    .then(payload => util.fromEither(GetContentResponse.decode(payload)))
}

// ---

import dc from './resources/pr-jira.json'

export const Config = t.exact(
  t.type({
    issueKeyRegex: t.string,
    fixVersionRegex: t.string,
    postMergeStatus: t.array(t.string),
  }),
)

export type IConfig = t.TypeOf<typeof Config>

export const DefaultConfig: IConfig = dc as IConfig

type Enc =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'latin1'
  | 'binary'
  | 'hex'
  | undefined

// ---

function getFromJson(bot: Context, repo: RepoRef, path: string, ref: string): Promise<{}> {
  return getContent(bot, repo, path, ref).then(resp => {
    const buff = Buffer.from(resp.data.content, resp.data.encoding as Enc)

    return JSON.parse(buff.toString('utf8'))
  })
}

export function getConfig(bot: Context, repo: RepoRef, ref: string): Promise<IConfig> {
  return getFromJson(bot, repo, '.github/pr-jira.json', ref)
    .then(json => util.fromEither(Config.decode(json)))
    .then(
      decoded => decoded,
      err => {
        bot.log.debug(`Fails to load configuration from branch '${ref}'`, err)

        return DefaultConfig
      },
    )
}
