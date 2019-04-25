import { none, some, fromNullable, Option } from 'fp-ts/lib/Option'
import * as either from 'fp-ts/lib/Either'

import * as t from 'io-ts'

import { GitHubAPI } from 'probot/lib/github'
import { LoggerWithTarget } from 'probot/lib/wrap-logger'
import { Application, Context } from 'probot'

import { createWebhookProxy } from 'probot/lib/webhook-proxy'

import { fromEither } from './util'

import * as c from './config'
import * as j from './jiraclient'

import { IHookSettings, IIssue } from './model/jira'
import { PullRequestEvent, PullRequestInfo, IPullRequestInfo } from './model/pullrequest'
import { ReposListStatusesForRefResponseItem } from '@octokit/rest'

const StatusContext = 'pr-jira'

type CommitState = 'success' | 'error' | 'failure' | 'pending'

const IssueInfo = t.exact(
  t.type({
    id: t.number,
    number: t.number,
    pull_request: t.union([t.any, t.undefined, t.null]),
  }),
)

type InstallRepo = { owner: string; repo: string }

type InstallContext = {
  id: string
  logger: LoggerWithTarget
  github: GitHubAPI
  jiraWebhookUrl: string
}

export = (app: Application) => {
  // Installation registry cache
  const installations: { [id: number]: ReadonlyArray<InstallRepo> } = {}

  installations[881510] = [
    {
      owner: 'cchantep',
      repo: 'mal',
    },
  ]

  setupJiraRouting(app)

  jiraWebhookUrl(app.log)
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
                    jiraWebhookUrl: jiraHookUrl,
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
          id: created.id,
          jiraWebhookUrl: jiraHookUrl,
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

      const credentials = await jiraCredentials(owner, repo)
      const hooks = await j.getHooks(credentials)

      context.log.debug('JIRA hooks', hooks)

      const installedHook = hooks.find(h => h.name == `pr-jira-${deleted.id}`)

      if (!installedHook) {
        return context.log(`No JIRA hook is matching installation ${deleted.id} for repository '${owner}/${repo}'`)
      }

      // ---

      context.log(`JIRA hook found for deleted installation ${deleted.id}`, installedHook)

      return await j.unregisterHook(credentials, installedHook.self)
    })

    delete installations[deleted.id]
  })

  // ---

  app.on(
    ['pull_request.opened', 'pull_request.edited', 'pull_request.synchronize', 'pull_request.reopened'],
    async context => {
      const event = await fromEither(PullRequestEvent.decode(context.payload))

      context.log.debug('Event', event)

      const pr = event.pull_request

      return mainHandler(context, pr)
    },
  )

  app.on('pull_request.closed', async context => {
    const event = context.payload.pull_request
    const prNumber = event.number

    if (!event.merged_at) {
      return context.log(`Pull request #${prNumber} is closed without merge`)
    }

    // ---

    context.log(`Pull request #${prNumber} is merged at ${event.merged_at}`)

    const repoInfo = context.repo({})
    const pr = await context.github.pullRequests
      .get({
        ...repoInfo,
        number: prNumber,
      })
      .then(resp => fromEither(PullRequestInfo.decode(resp.data)))

    const checkInterval = await c.getConfig(context, pr.base.ref).then(cfg => cfg.postMergeDelay)

    const postMergeCheck: () => Promise<void> = async () => {
      const config = await c.getConfig(context, pr.base.ref)
      const credentials = await jiraCredentials(repoInfo.owner, repoInfo.repo)

      return await withJiraIssue(context, pr, config, data => {
        const [issue, url] = data
        const jiraStatus = issue.fields.status.name
        const author = event.user.login

        if (config.postMergeStatus.find(s => s == jiraStatus)) {
          return Promise.resolve(
            context.log(`JIRA issue ${issue.key} for pull request #${prNumber} is now ${jiraStatus}`),
          )
        } else {
          const details = config.postMergeStatus.join(', ')
          const msg = `JIRA issue [${
            issue.key
          }](${url}) doesn't seem to have a valid status: '${jiraStatus}' !~ [${details}]`

          context.log(`${msg} (pull request #${prNumber})`)

          setTimeout(postMergeCheck, checkInterval) // schedule another check

          return context.github.issues
            .createComment({
              ...repoInfo,
              number: prNumber,
              body: `@${author} ${msg}. Please check it.`,
            })
            .then(_r => Promise.resolve())
        }
      })
    }

    setTimeout(postMergeCheck, checkInterval)
  })

  app.on('issues.milestoned', context => {
    return withIssuePR(context, pr => mainHandler(context, pr))
  })

  app.on('issues.demilestoned', context =>
    withIssuePR(context, pr => {
      return c.getConfig(context, pr.base.ref).then(config => {
        return withJiraIssue(context, pr, config, data => {
          const [issue, url] = data
          const msg = `Milestone expected to check with JIRA issue ${issue.key}`

          return toggleState(context, StatusContext, pr.head.sha, 'failure', msg, some(url))
        })
      })
    }),
  )
}

async function setupJiraRouting(app: Application): Promise<void> {
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

    app.log('BODY', req.body)

    await app.auth(installId).then(authed => {
      authed.apps.listRepos({}).then(r => {
        app.log('REPOS', r.data.repositories)

        res.end('Hello')
      })
    })
  })
}

async function jiraWebhookUrl(logger: LoggerWithTarget): Promise<string> {
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
  const { logger, id, github, jiraWebhookUrl } = ctx

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
    const credentials = await jiraCredentials(repoInfo.owner, repoInfo.repo)
    const hooks = await j.getHooks(credentials)
    const name = `pr-jira-${id}`
    const appHook = hooks.find(h => h.name == name)

    if (!!appHook) {
      logger(`JIRA hook already exists for installation ${id}`)
      return go(tail, out)
    }

    // ---

    const jiraProject = process.env[`${prefix}_JIRA_PROJECT_NAME`] || process.env['JIRA_PROJECT_NAME']

    logger.debug('jiraProject', jiraProject)

    const newHook: IHookSettings = {
      name,
      url: jiraWebhookUrl,
      enabled: true,
      events: ['jira:issue_updated', 'jira:issue_deleted'],
      filters: {
        'issue-related-events-section': `project = "${jiraProject}"`,
      },
    }

    logger('Register JIRA hook', newHook)

    return j.registerHook(credentials, newHook).then(_r => go(tail, out.concat(repoInfo)))
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

async function withIssuePR(context: Context, f: (pr: IPullRequestInfo) => Promise<void>): Promise<void> {
  const issue = context.payload.issue
  const event = await fromEither(IssueInfo.decode(issue))

  context.log.debug('Event', event)

  if (!event.pull_request) {
    context.log(`Not a pull request issue: #${event.id}`)
  } else {
    const resp = await context.github.pullRequests.get(
      context.repo({
        number: issue.number,
      }),
    )

    return fromEither(PullRequestInfo.decode(resp.data)).then(f)
  }
}

async function mainHandler(context: Context, pr: IPullRequestInfo): Promise<void> {
  const config = await c.getConfig(context, pr.base.ref)

  return withJiraIssue(context, pr, config, async data => {
    const [issue, url] = data

    if (!pr.milestone) {
      return context.log(
        `Pull request #${pr.number} is not milestoned: skip version consistency check for JIRA issue ${issue.key}`,
      )
    }

    // ---

    const milestone = pr.milestone

    context.log.debug('Issue fixVersions', issue.fields.fixVersions)

    const found = issue.fields.fixVersions.findIndex(v => {
      const vm = v.name.match(config.fixVersionRegex)

      if (!vm || vm.length < 2) {
        context.log(`Fix version ${v.name} doesn't match: ${config.fixVersionRegex}`)

        return false
      } else {
        return vm[1] == milestone.title
      }
    })

    if (found >= 0) {
      return toggleState(
        context,
        StatusContext,
        pr.head.sha,
        'success',
        `Consistent with JIRA issue ${issue.key}`,
        some(url),
      )
    } else {
      const details =
        issue.fields.fixVersions.length == 0 ? '<none>' : issue.fields.fixVersions.map(v => v.name).join(', ')

      context.log(
        `No JIRA fixVersion for issue '${issue.key}' is matching the milestone '${milestone.title}' of pull request #${
          pr.number
        }: ${details}`,
      )

      const description = `Milestone doesn't correspond to JIRA fixVersions for ${issue.key}: ${details}`.substring(
        0,
        140,
      )

      return toggleState(context, StatusContext, pr.head.sha, 'error', description, some(url))
    }
  })
}

async function withJiraIssue(
  context: Context,
  pr: IPullRequestInfo,
  config: c.IConfig,
  f: (data: [IIssue, string]) => Promise<void>,
): Promise<void> {
  const repoInfo: {
    owner: string
    repo: string
  } = context.repo({})

  const credentials = await jiraCredentials(repoInfo.owner, repoInfo.repo)

  context.log.debug('Credentials', credentials)
  context.log.debug('Config', config)

  const m = pr.title.match(config.issueKeyRegex)

  if (!m || m.length < 2) {
    return context.log(
      `Title of pull request #${pr.number} doesn't match issue expression (${config.issueKeyRegex}): ${pr.title}`,
    )
  }

  // ---

  const issueKey = m[1]
  const issueUrl = `https://${credentials.domain}/browse/${issueKey}`

  context.log.debug('Issue key', issueKey)

  const jiraIssue: either.Either<string, IIssue> = await j
    .getIssue(credentials, issueKey)
    .then(res => either.fromOption(`No JIRA issue '${issueKey}'`)(res))

  context.log.debug('jiraIssue', jiraIssue)

  return jiraIssue.fold(
    msg => {
      context.log(`${msg} corresponding to pull request #${pr.number}`)

      return toggleState(context, StatusContext, pr.head.sha, 'error', msg, none)
    },
    issue => f([issue, issueUrl]),
  )
}

// ---

function jiraCredentials(owner: string, repo: string): Promise<j.Credentials> {
  const prefix = `${owner}_${repo}`.toUpperCase()

  const domain = process.env[`${prefix}_JIRA_DOMAIN`] || process.env.JIRA_DOMAIN

  if (!domain) {
    return Promise.reject(new Error('Missing JIRA_DOMAIN'))
  }

  const username = process.env[`${prefix}_JIRA_USER`] || process.env.JIRA_USER

  if (!username) {
    return Promise.reject(new Error('Missing JIRA_USER'))
  }

  const apiToken = process.env[`${prefix}_JIRA_API_TOKEN`] || process.env.JIRA_API_TOKEN

  if (!apiToken) {
    return Promise.reject(new Error('Missing JIRA_API_TOKEN'))
  }

  return Promise.resolve({ domain, username, apiToken })
}

// ---

function toggleState(
  bot: Context,
  statusContext: string,
  sha: string,
  expectedState: CommitState,
  msg: string,
  url: Option<string>,
): Promise<void> {
  return getCommitStatus(bot, sha, statusContext).then(st => {
    const mustSet =
      expectedState == 'success'
        ? st.exists(s => s.state != 'success')
        : !st.exists(s => s.state == expectedState && s.description == msg)

    if (!mustSet) {
      return Promise.resolve()
    } else {
      return bot.github.repos
        .createStatus(
          bot.repo({
            sha: sha,
            context: statusContext,
            state: expectedState,
            description: msg,
            target_url: url.toUndefined(),
          }),
        )
        .then(_r => Promise.resolve())
    }
  })
}

function getCommitStatus(bot: Context, ref: string, ctx: string): Promise<Option<ReposListStatusesForRefResponseItem>> {
  return bot.github.repos.listStatusesForRef(bot.repo({ ref })).then(resp => {
    const found = resp.data.find(s => s.context == ctx)

    if (!found) {
      return Promise.resolve(none)
    } else {
      return Promise.resolve(some(found))
    }
  })
}
