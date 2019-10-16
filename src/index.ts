import { none, some, fromNullable, Option } from 'fp-ts/lib/Option'
import * as either from 'fp-ts/lib/Either'

import * as t from 'io-ts'

import { Application, Context } from 'probot'

import { fromEither } from './util'

import * as c from './config'
import * as jira from './jira/integration'
import * as j from './jira/client'

import { IIssue } from './model/jira'
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

    const checkInterval = await c.getConfig(context, pr.base.ref).then(cfg => cfg.postMergeDelay)

    const postMergeCheck: () => Promise<void> = async () => {
      const config = await c.getConfig(context, pr.base.ref)
      const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

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
          const msg = `JIRA issue [${issue.key}](${url}) doesn't seem to have a valid status: '${jiraStatus}' !~ [${details}]`

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

  app.on('repository_dispatch', async context => {
    const i = context.payload.action.indexOf(':')

    if (i == -1) {
      context.log('Invalid action', context.payload.action)
      return
    }

    // ---

    const extPayload = JSON.parse(context.payload.action.substring(i+1))

    context.log('Dispatch', {
      extPayload: extPayload, payload: context.payload
    })
  })

  app.on('schedule', async context => {
    // event: schedule
    context.log('Schedule', { event: context.event, action: context.payload })
  })

  app.on(`*`, async context => {
    // event: schedule
    context.log({ event: context.event, action: context.payload })
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
        `No JIRA fixVersion for issue '${issue.key}' is matching the milestone '${milestone.title}' of pull request #${pr.number}: ${details}`,
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

  const credentials = await jira.credentials(repoInfo.owner, repoInfo.repo)

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
