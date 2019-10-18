import { exists, none, some, fromNullable, toUndefined, Option } from 'fp-ts/lib/Option'
import * as either from 'fp-ts/lib/Either'

import * as t from 'io-ts'

import { Application, Context } from 'probot'

import { fromEither } from './util'

import * as c from './config'
import * as jira from './jira/integration'
import * as j from './jira/client'

import { IIssue } from './model/jira'
import { CommitState, PullRequestEvent, PullRequestInfo, IPullRequestInfo, RepoRef } from './model/pullrequest'

import { PullsListResponseItem, ReposListStatusesForRefResponseItem } from '@octokit/rest'

const StatusContext = 'pr-jira'

const IssueInfo = t.exact(
  t.type({
    id: t.number,
    number: t.number,
    pull_request: t.union([t.any, t.undefined, t.null]),
  }),
)

export = (app: Application) => {
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
    const pr = await context.github.pulls
      .get({
        ...repoInfo,
        pull_number: prNumber,
      })
      .then(resp => fromEither(PullRequestInfo.decode(resp.data)))

    const config = await c.getConfig(context, repoInfo, pr.base.ref)
    const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

    return checkIsClosed(
      context, config, repoInfo, credentials, event.user.login, pr)
  })

  app.on('issues.milestoned', context => {
    return withIssuePR(context, pr => mainHandler(context, pr))
  })

  app.on('issues.demilestoned', context =>
    withIssuePR(context, pr => {
      const repo = context.repo({})

      return c.getConfig(context, repo, pr.base.ref).then(config => {
        return withJiraIssue(context, repo, pr, config, data => {
          const [issue, url] = data
          const msg = `Milestone expected to check with JIRA issue ${issue.key}`

          return toggleState(
            context,
            repo,
            StatusContext,
            pr.head.sha,
            'failure',
            msg,
            some(url)
          )
        })
      })
    }),
  )

  app.on('repository_dispatch', async context => {
    const i = context.payload.action.indexOf('@')

    if (i == -1) {
      context.log('Invalid action', context.payload.action)
      return
    }

    // ---

    const jiraIssueId = context.payload.action.substring(i + 1)
    const repoInfo = context.repo({})

    context.log('JIRA issue event', { jiraIssueId, repo: repoInfo })

    const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)
    const jiraIssue = toUndefined(await j.getIssue(credentials, jiraIssueId))

    if (!jiraIssue) {
      context.log(`No JIRA found: ${jiraIssueId}`)
      return
    }

    // TODO: check whether jiraIssue is closed

    // ---

    const issue: IIssue = jiraIssue

    context.log.debug('JIRA issue', issue)

    const resp = await context.github.pulls.list({
      ...repoInfo,
      state: 'open',
    })

    // TODO: config
    async function find(items: ReadonlyArray<PullsListResponseItem>): Promise<[IPullRequestInfo, c.IConfig] | undefined> {
      if (items.length < 1) {
        return Promise.resolve(undefined)
      }

      // ---

      const pr = items[0]

      const config = await c.getConfig(context, repoInfo, pr.base.ref)
      const issueKey = jiraIssueKey(context, config, pr)

      context.log.debug(`Check pull request #${pr.number} against issue ${jiraIssueId}`, issueKey)

      if (!either.exists((k: string) => k == issue.key)(issueKey)) {
        return find(items.slice(1))
      }

      // ---

      return fromEither(PullRequestInfo.decode(pr)).then(r => [r, config])
    }

    const result = await find(resp.data)

    if (!result) {
      return context.log(`No open pull request matching the updated JIRA issue ${issue.key}`)
    }

    // ---

    const prInfo = result[0]
    const config = result[1]

    context.log('Matching pull request', prInfo)

    const issueUrl = `https://${credentials.domain}/browse/${issue.key}`

    checkMilestone(context, repoInfo, config, prInfo, issue, issueUrl)
  })

  app.on('schedule', async context => {
    const r = scheduledRepoInfo(context)

    if (!r) {
      return context.log.error('Cannot perform period check without repository')
    }

    // ---

    const repoInfo: RepoRef = r

    context.log('Periodic check', repoInfo)

    const resp = await context.github.pulls.list({
      ...repoInfo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 50
    })

    const merged = resp.data.filter(i => !!i.merged_at)
    const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

    async function check(items: ReadonlyArray<PullsListResponseItem>): Promise<void> {
      if (items.length == 0) {
        return context.log.debug('End periodic check', repoInfo)
      }

      // ---

      const pr = await fromEither(PullRequestInfo.decode(items[0]))
      const config = await c.getConfig(context, repoInfo, pr.base.ref)

      context.log(`Closed PR #${pr.number}`)

      return checkIsClosed(
        context, config, repoInfo, credentials, pr.user.login, pr)
        .then(_r => check(items.slice(1)))
    }

    check(merged)
  })

  app.on(`*`, async context => {
    const r = scheduledRepoInfo(context)

    if (!r) {
      return context.log.error('Cannot perform period check without repository')
    }

    // ---

    const repoInfo: RepoRef = r

    context.log.debug('Checking JIRA hook', { repo: repoInfo })

    jira.ensureHook({
      repo: repoInfo,
      github: context.github,
      log: context.log,
    })
  })
}

function scheduledRepoInfo(context: Context): RepoRef | undefined {
  try {
    return context.repo({})
  } catch(e) {
    context.log.debug('Default repository resolution fails', e)
  }

  // ---

  // As .repo(..) may not be allowed on 'schedule' event
  if (!process.env.GITHUB_REPOSITORY) {
    context.log.warn('Fails to resolve repository (no GITHUB_REPOSITORY)')
    return
  }

  // ---

  const rd = process.env.GITHUB_REPOSITORY.split('/')

  if (rd.length != 2) {
    context.log.warn(`Malformed GITHUB_REPOSITORY: ${process.env.GITHUB_REPOSITORY}`)
    return
  }

  // ---

  return { owner: rd[0], repo: rd[1] }
}

function checkIsClosed(
  context: Context,
  config: c.IConfig,
  repoInfo: RepoRef,
  credentials: j.Credentials,
  author: string,
  pr: IPullRequestInfo
): Promise<void> {
  return withJiraIssue(context, repoInfo, pr, config, data => {
    const [issue, url] = data
    const jiraStatus = issue.fields.status.name

    if (config.postMergeStatus.find(s => s == jiraStatus)) {
      return Promise.resolve(
        context.log(`JIRA issue ${issue.key} for pull request #${pr.number} is now '${jiraStatus}'`),
      )
    } else {
      const details = config.postMergeStatus.join(', ')
      const msg = `JIRA issue [${issue.key}](${url}) doesn't seem to have a valid status: '${jiraStatus}' !~ [${details}]`
      
      context.log(`${msg} (pull request #${pr.number})`)
      
      return context.github.issues
        .createComment({
          ...repoInfo,
          issue_number: pr.number,
          body: `@${author} ${msg}. Please check it.`,
        }).then(_r => Promise.resolve())
    }
  })
}

async function withIssuePR(context: Context, f: (pr: IPullRequestInfo) => Promise<void>): Promise<void> {
  const issue = context.payload.issue
  const event = await fromEither(IssueInfo.decode(issue))

  context.log.debug('Event', event)

  if (!event.pull_request) {
    context.log(`Not a pull request issue: #${event.id}`)
  } else {
    const resp = await context.github.pulls.get(
      context.repo({
        pull_number: issue.number,
      }),
    )

    return fromEither(PullRequestInfo.decode(resp.data)).then(f)
  }
}

async function mainHandler(context: Context, pr: IPullRequestInfo): Promise<void> {
  const repo = context.repo({})
  const config = await c.getConfig(context, repo, pr.base.ref)

  return withJiraIssue(context, repo, pr, config, async data => {
    const [issue, url] = data

    checkMilestone(context, repo, config, pr, issue, url)
  })
}

async function checkMilestone(
  context: Context,
  repo: RepoRef,
  config: c.IConfig,
  pr: IPullRequestInfo,
  issue: IIssue,
  issueUrl: string,
): Promise<void> {
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
      repo,
      StatusContext,
      pr.head.sha,
      'success',
      `Consistent with JIRA issue ${issue.key}`,
      some(issueUrl),
    )
  } else {
    const details =
      issue.fields.fixVersions.length == 0 ? '<none>' : issue.fields.fixVersions.map(v => v.name).join(', ')

    context.log(
      `No JIRA fixVersion for issue '${issue.key}' is matching the milestone '${milestone.title}' of pull request #${pr.number}: ${details}`,
    )

    const description = `Milestone doesn't correspond to JIRA fixVersions for ${issue.key}: ${details}`.substring(
      0,
      140,
    )

    return toggleState(
      context,
      repo,
      StatusContext,
      pr.head.sha,
      'error',
      description,
      some(issueUrl)
    )
  }
}

async function withJiraIssue(
  context: Context,
  repoInfo: RepoRef,
  pr: IPullRequestInfo,
  config: c.IConfig,
  f: (data: [IIssue, string]) => Promise<void>,
): Promise<void> {
  context.log.debug('Config', config)

  const issueKey = jiraIssueKey(context, config, pr)

  context.log.debug('Issue key', issueKey)

  either.fold(
    (msg: string) => {
      context.log(`Pull request #${pr.number} ${msg}`)

      return toggleState(
        context,
        repoInfo,
        StatusContext,
        pr.head.sha,
        'success',
        msg,
        none
      )
    },
    async (k: string) => {
      const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

      context.log.debug('Credentials', credentials)

      const jiraIssue: either.Either<string, IIssue> = await j.getIssue(credentials, k).then((res: Option<IIssue>) => {
        return either.fromOption(() => `No JIRA issue '${k}'`)(res)
      })

      context.log.debug('jiraIssue', jiraIssue)

      return either.fold(
        (msg: string) => {
          context.log(`${msg} corresponding to pull request #${pr.number}`)

          return toggleState(
            context,
            repoInfo,
            StatusContext,
            pr.head.sha,
            'error',
            msg,
            none
          )
        },
        (issue: IIssue) => {
          const issueUrl = `https://${credentials.domain}/browse/${issue.key}`

          return f([issue, issueUrl])
        },
      )(jiraIssue)
    },
  )(issueKey)
}

// ---

function jiraIssueKey(
  context: Context,
  config: c.IConfig,
  pr: { title: string; number: number },
): either.Either<string, string> {
  const m = pr.title.match(config.issueKeyRegex)

  if (!m || m.length < 2) {
    const msg = `doesn't match issue expression (${config.issueKeyRegex})`

    context.log.debug(`Title of pull request #${pr.number} ${msg}: ${pr.title}`)

    return either.left(msg)
  } else {
    return either.right(m[1])
  }
}

const isSuccessful = exists((s: ReposListStatusesForRefResponseItem) => s.state != 'success')

function toggleState(
  bot: Context,
  repo: RepoRef,
  statusContext: string,
  sha: string,
  expectedState: CommitState,
  msg: string,
  url: Option<string>,
): Promise<void> {
  return getCommitStatus(bot, repo, sha, statusContext).then(st => {
    const mustSet =
      expectedState == 'success'
        ? isSuccessful(st)
        : !exists((s: ReposListStatusesForRefResponseItem) => s.state == expectedState && s.description == msg)(st)

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
            target_url: toUndefined(url),
          }),
        )
        .then(_r => Promise.resolve())
    }
  })
}

function getCommitStatus(
  bot: Context,
  repo: RepoRef,
  ref: string,
  ctx: string
): Promise<Option<ReposListStatusesForRefResponseItem>> {
  return bot.github.repos.listStatusesForRef({ ...repo, ref }).then(resp => {
    const found = resp.data.find(s => s.context == ctx)

    if (!found) {
      return Promise.resolve(none)
    } else {
      return Promise.resolve(some(found))
    }
  })
}
