import { map, fold, exists, none, some, fromNullable, toUndefined, Option } from 'fp-ts/lib/Option'
import * as either from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/pipeable'

import * as t from 'io-ts'

import { Application, Context } from 'probot'

import { fromEither } from './util'

import * as c from './config'
import * as jira from './jira/integration'
import * as j from './jira/client'

import { IIssue } from './model/jira'
import { CommitState, PullRequestEvent, PullRequestInfo, IPullRequestInfo, RepoRef } from './model/pullrequest'

import { Octokit } from '@octokit/rest'

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
    async (context) => {
      const event = await fromEither(PullRequestEvent.decode(context.payload))

      context.log.debug('Event', event)

      const pr = event.pull_request

      return mainHandler(context, pr)
    },
  )

  app.on('pull_request.closed', async (context) => {
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
      .then((resp) => fromEither(PullRequestInfo.decode(resp.data)))

    const config = await c.getConfig(context, repoInfo, pr.head.ref)
    const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

    return checkIsClosed(context, config, repoInfo, credentials, event.user.login, pr)
  })

  app.on('issues.milestoned', (context) => {
    return withIssuePR(context, (pr) => {
      context.log(`Milestoning pull request #${pr.number}`)

      return mainHandler(context, pr)
    })
  })

  app.on('issues.demilestoned', (context) =>
    withIssuePR(context, async (pr) => {
      context.log(`Demilestoning pull request #${pr.number}`)

      const repo = context.repo({})
      const config = await c.getConfig(context, repo, pr.head.ref)

      return withJiraIssue(context, repo, pr, config, (data) => {
        const [issue, url] = data
        const msg = `Milestone expected to check with JIRA issue ${issue.key}`

        return toggleState(context, repo, StatusContext, pr.head.sha, 'failure', msg, some(url))
      })
    }),
  )

  app.on('repository_dispatch', async (context) => {
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

    // TODO: check whether jiraIssue is closed?

    // ---

    const issue: IIssue = jiraIssue

    context.log.debug('JIRA issue', issue)

    const resp = await context.github.pulls.list({
      ...repoInfo,
      state: 'open',
    })

    async function find(
      items: ReadonlyArray<Octokit.PullsListResponseItem>,
    ): Promise<[IPullRequestInfo, c.IConfig] | undefined> {
      if (items.length < 1) {
        return Promise.resolve(undefined)
      }

      // ---

      const pr = items[0]

      const config = await c.getConfig(context, repoInfo, pr.head.ref)
      const issueKey = jiraIssueKey(context, config, pr)

      context.log.debug(`Check pull request #${pr.number} against issue ${jiraIssueId}`, issueKey)

      if (!either.exists((k: string) => k == issue.key)(issueKey)) {
        return find(items.slice(1))
      }

      // ---

      return fromEither(PullRequestInfo.decode(pr)).then((r) => [r, config])
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

  app.on('schedule', async (context) => {
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
      per_page: 50,
    })

    const merged = resp.data.filter((i) => !!i.merged_at)
    const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

    async function check(items: ReadonlyArray<Octokit.PullsListResponseItem>): Promise<void> {
      if (items.length == 0) {
        return context.log.debug('End periodic check', repoInfo)
      }

      // ---

      const pr = await fromEither(PullRequestInfo.decode(items[0]))
      const config = await c.getConfig(context, repoInfo, pr.head.ref)

      context.log(`Closed PR #${pr.number}`)

      return checkIsClosed(context, config, repoInfo, credentials, pr.user.login, pr).then((_r) =>
        check(items.slice(1)),
      )
    }

    check(merged)
  })

  app.on(`*`, async (context) => {
    const r = scheduledRepoInfo(context)

    if (!r) {
      return context.log.error('Cannot perform period check without repository')
    }

    // ---

    const repoInfo: RepoRef = r

    context.log.debug('Checking JIRA hook', { repo: repoInfo })

    const p = context.payload

    const branch =
      p['pull_request'] && p.pull_request && p.pull_request['head']
        ? p.pull_request.head.ref
        : p['repository']
        ? p.repository.default_branch
        : null

    const cfg = branch ? c.getConfig(context, repoInfo, branch) : c.getConfig(context, repoInfo, 'master')

    cfg.then((config) => {
      const baseUrl = config.githubDispatchBaseUrl || 'https://pr-jira-gh.herokuapp.com'

      return jira.ensureHook({
        repo: repoInfo,
        github: context.github,
        log: context.log,
        githubDispatchBaseUrl: baseUrl,
      })
    })
  })
}

function scheduledRepoInfo(context: Context): RepoRef | undefined {
  try {
    return context.repo({})
  } catch (e) {
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
  pr: IPullRequestInfo,
): Promise<void> {
  return withJiraIssue(context, repoInfo, pr, config, (data) => {
    const [issue, url] = data
    const jstatus1 = issue.fields.status.name
    const jstatus2 = issue.fields.status.untranslatedName

    if (config.postMergeStatus.find((s) => s == jstatus1 || s == jstatus2)) {
      return Promise.resolve(
        context.log(`JIRA issue ${issue.key} for pull request #${pr.number} is now ['${jstatus1}', '${jstatus2}']`),
      )
    } else {
      const details = config.postMergeStatus.join(', ')
      const msg = `JIRA issue [${issue.key}](${url}) doesn't seem to have a valid status: ['${jstatus1}', '${jstatus2}'] !~ [${details}]`

      context.log(`${msg} (pull request #${pr.number})`)

      return context.github.issues
        .createComment({
          ...repoInfo,
          issue_number: pr.number,
          body: `@${author} ${msg}. Please check it.`,
        })
        .then((_r) => Promise.resolve())
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
  const config = await c.getConfig(context, repo, pr.head.ref)

  return withJiraIssue(context, repo, pr, config, async (data) => {
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

  const re = config.milestoneRegex || '^(.+)$'
  const minfo = pr.milestone.title.match(re)

  context.log.debug(`milestoneRegex = ${re}`)

  if (!minfo || minfo.length < 2) {
    const msg = `Milestone ${pr.milestone.title} doesn't match ${re}`

    context.log(msg)

    return toggleState(context, repo, StatusContext, pr.head.sha, 'error', msg, none)
  }

  // ---

  const milestone = minfo[1]

  context.log(`Checking normalized milestone '${milestone}' (${pr.milestone.title}) ...`)

  context.log.debug('Issue fixVersions', issue.fields.fixVersions)

  const found = issue.fields.fixVersions.findIndex((v) => {
    const vm = v.name.match(config.fixVersionRegex)

    if (!vm || vm.length < 2) {
      context.log(`Fix version '${v.name}' doesn't match: ${config.fixVersionRegex}`)

      return false
    } else {
      context.log.debug(`Normalized fixVersion = ${JSON.stringify(vm)}`)

      return vm[1] == milestone
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
      issue.fields.fixVersions.length == 0 ? '<none>' : issue.fields.fixVersions.map((v) => v.name).join(', ')

    context.log(
      `No JIRA fixVersion for issue '${issue.key}' is matching the milestone '${pr.milestone.title}' of pull request #${pr.number}: ${details}`,
    )

    const description = `Milestone '${pr.milestone.title}' doesn't match '${issue.key}' fixVersion ${details}: ${config.fixVersionRegex}`.substring(
      0,
      140,
    )

    return toggleState(context, repo, StatusContext, pr.head.sha, 'error', description, some(issueUrl))
  }
}

function runUrl(pr: IPullRequestInfo): Option<string> {
  return pipe(
    fromNullable(process.env['GITHUB_RUN_ID']),
    map((id) => {
      const i = pr.html_url.indexOf('/pull/')
      const repoUrl = pr.html_url.substring(0, i)

      return `${repoUrl}/actions/runs/${id}`
    }),
  )
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

  either.fold(
    (err: Error) => {
      const msg = err.message

      return context.log(`Cannot parse JIRA issue key for pull request #${pr.number}: ${msg}`)

      // TODO: Add a setting to request to raise error in this case
      //return toggleState(context, repoInfo, StatusContext, pr.head.sha, 'success', msg, none)
    },
    async (k: string) => {
      context.log(`Pull request #${pr.number} corresponds to JIRA issue ${k}`)

      const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

      context.log.debug('Credentials', credentials)

      const jiraIssue: either.Either<string, IIssue> = await j.getIssue(credentials, k).then(
        (res: Option<IIssue>) => {
          return either.fromOption(() => `No JIRA issue '${k}'`)(res)
        },
        (err) => either.left(err.message),
      )

      context.log.debug('jiraIssue', jiraIssue)

      return either.fold(
        (msg: string) => {
          context.log(`Fails to get JIRA issue ${k} for pull request #${pr.number} (check JIRA connectivity): ${msg}`)

          return toggleState(context, repoInfo, StatusContext, pr.head.sha, 'error', msg, runUrl(pr))
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
): either.Either<Error, string> {
  const m = pr.title.match(config.issueKeyRegex)

  if (!m || m.length < 2) {
    const msg = `doesn't match issue expression (${config.issueKeyRegex})`

    context.log.debug(`Title of pull request #${pr.number} ${msg}: ${pr.title}`)

    return either.left(new Error(msg))
  } else {
    return either.right(m[1])
  }
}

const isSuccessful = exists((s: Octokit.ReposListStatusesForRefResponseItem) => s.state != 'success')

function toggleState(
  bot: Context,
  repo: RepoRef,
  statusContext: string,
  sha: string,
  expectedState: CommitState,
  msg: string,
  url: Option<string>,
): Promise<void> {
  return getCommitStatus(bot, repo, sha, statusContext).then((st) => {
    const mustSet =
      expectedState == 'success'
        ? isSuccessful(st)
        : !exists(
            (s: Octokit.ReposListStatusesForRefResponseItem) =>
              s.state == expectedState &&
              s.description == msg &&
              pipe(
                url,
                fold(
                  () => s.target_url == null,
                  (u) => u == s.target_url,
                ),
              ),
          )(st)

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
        .then((_r) => Promise.resolve())
    }
  })
}

function getCommitStatus(
  bot: Context,
  repo: RepoRef,
  ref: string,
  ctx: string,
): Promise<Option<Octokit.ReposListStatusesForRefResponseItem>> {
  return bot.github.repos.listStatusesForRef({ ...repo, ref }).then((resp) => {
    const found = resp.data.find((s) => s.context == ctx)

    if (!found) {
      return Promise.resolve(none)
    } else {
      return Promise.resolve(some(found))
    }
  })
}
