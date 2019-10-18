import { Application, Context } from 'probot'

import { GitHubAPI } from 'probot/lib/github'
import { LoggerWithTarget } from 'probot/lib/wrap-logger'

import { createWebhookProxy } from 'probot/lib/webhook-proxy'

import { fromEither } from '../util'

import { IHookSettings } from '../model/jira'
import * as j from './client'

type InstallRepo = { owner: string; repo: string }

type InstallContext = {
  id: string
  logger: LoggerWithTarget
  github: GitHubAPI
  webhookUrl: string
}

type EventContext = {
  repo: InstallRepo
  github: GitHubAPI
  log: LoggerWithTarget
}

export async function ensureHook(ctx: EventContext): Promise<InstallRepo> {
  const repoInfo = ctx.repo
  const logger = ctx.log

  const prefix = `${repoInfo.owner}_${repoInfo.repo}`.toUpperCase()
  const creds = await credentials(repoInfo.owner, repoInfo.repo)
  const hooks = await j.getHooks(creds)
  const name = `github-pr-jira-${prefix}`
  const appHook = hooks.find(h => h.name == name)

  if (!!appHook) {
    logger(`JIRA hook already exists for ${prefix}`)
    return Promise.resolve(ctx.repo)
  }

  // ---

  const jiraProject = process.env[`${prefix}_JIRA_PROJECT_NAME`] || process.env.JIRA_PROJECT_NAME

  logger.debug('jiraProject', jiraProject)

  const ghTok = process.env.PERSONAL_TOKEN_VALUE

  if (!ghTok) {
    return Promise.reject(new Error('Missing PERSONAL_TOKEN_VALUE'))
  }

  const ghUser = process.env.PERSONAL_TOKEN_USER

  if (!ghUser) {
    return Promise.reject(new Error('Missing PERSONAL_TOKEN_USER'))
  }

  // ---

  const webhookUrl = `https://gh-redispatch.herokuapp.com/jira/${repoInfo.owner}/${repoInfo.repo}?user=${ghUser}&pass=${ghTok}`

  const newHook: IHookSettings = {
    name,
    url: webhookUrl,
    enabled: true,
    events: ['jira:issue_updated', 'jira:issue_deleted'],
    filters: {
      'issue-related-events-section': `project = "${jiraProject}"`,
    },
  }

  logger('Registering new JIRA hook ...', { ...newHook, url: '***' })

  return j.registerHook(creds, newHook).then(_r => ctx.repo)
}

export function credentials(owner: string, repo: string): Promise<j.Credentials> {
  const prefix = `${owner}_${repo}`.toUpperCase()

  const domain = process.env[`${prefix}_JIRA_DOMAIN`] || process.env.JIRA_DOMAIN

  if (!domain) {
    return Promise.reject(new Error(`Missing JIRA domain: ${domain}`))
  }

  const username = process.env[`${prefix}_JIRA_USER`] || process.env.JIRA_USER

  if (!username) {
    return Promise.reject(new Error('Missing JIRA user'))
  }

  const apiToken = process.env[`${prefix}_JIRA_API_TOKEN`] || process.env.JIRA_API_TOKEN

  if (!apiToken) {
    return Promise.reject(new Error('Missing JIRA API token'))
  }

  return Promise.resolve({ domain, username, apiToken })
}

/*
  // TODO
  jiraRoutes.post('/hook*', async (req: any, res: any) => {
    app.log('Request', req.query)

    const param: string | undefined = req.query['installation_id']

    if (!param) {
      app.log('Invalid parameter on JIRA hook', param)
      return res.sendStatus(400)
    }

    const installId: number = parseInt(param, 10)

    if (isNaN(installId)) {
      app.log('Invalid installation ID on JIRA hook', installId)
      return res.sendStatus(400)
    }

    // ---

    app.log(`Received request on JIRA hook for installation ${installId}`)

    const issueEvent = await fromEither(IssueCallback.decode(req.body))

    app.log('issueEvent', issueEvent)

    await app.auth(installId).then(authed => {
      authed.apps.listRepos({}).then(r => {
        app.log('REPOS', r.data.repositories)

        res.end('Hello')
      })
    })
  })

*/
