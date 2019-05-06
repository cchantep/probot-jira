import { Application, Context } from 'probot'

import { GitHubAPI } from 'probot/lib/github'
import { LoggerWithTarget } from 'probot/lib/wrap-logger'

import { createWebhookProxy } from 'probot/lib/webhook-proxy'

import { fromEither } from '../util'

import { IHookSettings, IssueCallback } from '../model/jira'
import * as j from './client'

type InstallRepo = { owner: string; repo: string }

type InstallContext = {
  id: string
  logger: LoggerWithTarget
  github: GitHubAPI
  webhookUrl: string
}

export const setup = (app: Application) => {
  // Installation registry cache
  const installations: { [id: number]: ReadonlyArray<InstallRepo> } = {}

  installations[881510] = [
    {
      owner: 'cchantep',
      repo: 'mal',
    },
  ]

  setupRouting(app)

  webhookUrl(app.log)
    .then(jiraHookUrl => {
      return app
        .auth()
        .then(api => {
          return api.apps.listInstallations({}).then(r => {
            return r.data.forEach(i => {
              return app
                .auth(i.id)
                .then(a =>
                  onInstallation({
                    logger: app.log,
                    github: a,
                    id: i.id.toString(),
                    webhookUrl: jiraHookUrl,
                  }),
                )
                .then(repos => {
                  installations[i.id] = repos

                  return void 0
                })
            })
          })
        })
        .then(_r => jiraHookUrl)
    })
    .then(jiraHookUrl => {
      return app.on('installation.created', async context => {
        const repos = await context.github.apps.listRepos({})
        const created = context.payload.installation

        return await onInstallation({
          logger: context.log,
          github: context.github,
          id: created.id.toString(),
          webhookUrl: jiraHookUrl,
        }).then(repos => {
          installations[created.id] = repos

          return void 0
        })
      })
    })

  app.on('installation.deleted', async context => {
    const deleted = context.payload.installation

    context.log(`Installation ${deleted.id} deleted`)

    const repos = installations[deleted.id]

    if (!repos) {
      return context.log(`No repostory found for deleted installation ${deleted.id}`)
    }

    // ---

    repos.forEach(async r => {
      const { owner, repo } = r

      context.log(`Cleaning JIRA hooks for repository '${owner}/${repo}'`)

      const creds = await credentials(owner, repo)
      const hooks = await j.getHooks(creds)

      context.log.debug('JIRA hooks', hooks)

      const installedHook = hooks.find(h => h.name == `pr-jira-${deleted.id}`)

      if (!installedHook) {
        return context.log(`No JIRA hook is matching installation ${deleted.id} for repository '${owner}/${repo}'`)
      }

      // ---

      context.log(`JIRA hook found for deleted installation ${deleted.id}`, installedHook)

      return await j.unregisterHook(creds, installedHook.self)
    })

    delete installations[deleted.id]
  })
}

async function setupRouting(app: Application): Promise<void> {
  // Routing
  const jiraRoutes = app.route('/jira')
  const express = require('express')

  jiraRoutes.use(express.json())

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
}

async function webhookUrl(logger: LoggerWithTarget): Promise<string> {
  const smeeKey = 'JIRA_WEBHOOK_PROXY_URL'

  // Proxy
  const createJiraChannel: () => Promise<string> = () => {
    logger('Setup smee.io channel for JIRA webhook')

    const smee = require('smee-client')

    return smee.createChannel().then((res: any) => {
      const url = res.toString()

      logger(`Save ${url} in .env as ${smeeKey}`)

      return url
    })
  }

  const jiraHookUrl = await Promise.resolve(process.env[smeeKey]).then(configured => configured || createJiraChannel())

  if (jiraHookUrl.substring(0, 15) == 'https://smee.io') {
    logger(`Create webhook proxy for JIRA/smee.io channel of ${jiraHookUrl}`)

    const port: number = parseInt(process.env['PORT'] || '3000', 10)

    createWebhookProxy({
      logger,
      port,
      path: '/jira/hook',
      url: jiraHookUrl,
    })
  }

  return jiraHookUrl
}

function onInstallation(ctx: InstallContext): Promise<ReadonlyArray<InstallRepo>> {
  const { logger, id, github, webhookUrl } = ctx

  const go: (input: Array<InstallRepo>, out: Array<InstallRepo>) => Promise<ReadonlyArray<InstallRepo>> = async (
    input: Array<InstallRepo>,
    out: Array<InstallRepo>,
  ) => {
    if (input.length == 0) {
      return Promise.resolve(out)
    }

    // ---

    const repoInfo = input[0]
    const tail = input.slice(1)

    const prefix = `${repoInfo.owner}_${repoInfo.repo}`.toUpperCase()
    const creds = await credentials(repoInfo.owner, repoInfo.repo)
    const hooks = await j.getHooks(creds)
    const name = `pr-jira-${id}`
    const appHook = hooks.find(h => h.name == name)

    if (!!appHook) {
      logger(`JIRA hook already exists for installation ${id}`)
      return go(tail, out)
    }

    // ---

    const jiraProject = process.env[`${prefix}_JIRA_PROJECT_NAME`] || process.env.INPUT_JIRA_PROJECT_NAME

    logger.debug('jiraProject', jiraProject)

    const newHook: IHookSettings = {
      name,
      url: webhookUrl,
      enabled: true,
      events: ['jira:issue_updated', 'jira:issue_deleted'],
      filters: {
        'issue-related-events-section': `project = "${jiraProject}"`,
      },
    }

    logger('Register JIRA hook', newHook)

    return j.registerHook(creds, newHook).then(_r => go(tail, out.concat(repoInfo)))
  }

  return github.apps.listRepos({}).then(r => {
    return go(
      r.data.repositories.map(repo => {
        const repoInfo: InstallRepo = {
          owner: repo.owner.login,
          repo: repo.name,
        }

        return repoInfo
      }),
      [],
    )
  })
}

export function credentials(owner: string, repo: string): Promise<j.Credentials> {
  const prefix = `${owner}_${repo}`.toUpperCase()

  const domain = process.env[`${prefix}_JIRA_DOMAIN`] || process.env.INPUT_JIRA_DOMAIN

  if (!domain) {
    return Promise.reject(new Error('Missing JIRA_DOMAIN'))
  }

  const username = process.env[`${prefix}_JIRA_USER`] || process.env.INPUT_JIRA_USER

  if (!username) {
    return Promise.reject(new Error('Missing JIRA_USER'))
  }

  const apiToken = process.env[`${prefix}_JIRA_API_TOKEN`] || process.env.INPUT_JIRA_API_TOKEN

  if (!apiToken) {
    return Promise.reject(new Error('Missing JIRA_API_TOKEN'))
  }

  return Promise.resolve({ domain, username, apiToken })
}
