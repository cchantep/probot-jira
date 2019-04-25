import { Context } from 'probot'

import * as t from 'io-ts'
import { none, some, Option } from 'fp-ts/lib/Option'

import * as util from './util'

// ---

import { GetContentResponse, IGetContentResponse } from './model/content'

function getContent(bot: Context, path: string, ref: string): Promise<IGetContentResponse> {
  return bot.github.repos
    .getContents(bot.repo({ path, ref }))
    .then(payload => util.fromEither(GetContentResponse.decode(payload)))
}

// ---

import dc from './resources/pr-jira.json'

export const Config = t.exact(
  t.type({
    issueKeyRegex: t.string,
    fixVersionRegex: t.string,
    postMergeStatus: t.array(t.string),
    postMergeDelay: t.number,
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

function getFromJson(bot: Context, path: string, ref: string): Promise<{}> {
  return getContent(bot, path, ref).then(resp => {
    const buff = Buffer.from(resp.data.content, resp.data.encoding as Enc)

    return JSON.parse(buff.toString('utf8'))
  })
}

export function getConfig(bot: Context, ref: string): Promise<IConfig> {
  return getFromJson(bot, '.github/pr-jira.json', ref)
    .then(json => util.fromEither(Config.decode(json)))
    .then(
      decoded => decoded,
      err => {
        bot.log.debug(`Fails to load configuration from branch '${ref}'`, err)

        return DefaultConfig
      },
    )
}
