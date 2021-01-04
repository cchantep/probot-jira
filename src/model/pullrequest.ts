import * as t from 'io-ts'

export type RepoRef = { owner: string, repo: string }

export type CommitState = 'success' | 'error' | 'failure' | 'pending'

export const UserInfo = t.exact(
  t.type({
    login: t.string,
  }),
)

const BranchInfo = t.exact(
  t.type({
    label: t.string,
    ref: t.string,
    sha: t.string,
  }),
)

export const Label = t.partial({
  name: t.union([ t.string, t.undefined ]),
})

const MilestoneInfo = t.exact(t.type({
  url: t.string,
  title: t.string,
  description: t.union([ t.string, t.null ]),
}))

export const PullRequestInfo = t.exact(
  t.type({
    number: t.number,
    html_url: t.string, // TODO: url
    state: t.string, // TODO: enum
    title: t.string,
    user: t.union([ UserInfo, t.null ]),
    base: BranchInfo,
    head: BranchInfo,
    labels: t.array(Label),
    milestone: t.union([ MilestoneInfo, t.null ])
  }),
)

export type IPullRequestInfo = t.TypeOf<typeof PullRequestInfo>

// --- Events

const RepoInfo = t.exact(
  t.type({
    id: t.number,
    name: t.string,
    owner: UserInfo,
  }),
)

const prEventBase = {
  pull_request: PullRequestInfo,
  repository: RepoInfo,
  sender: UserInfo
}

export const PullRequestEvent = t.exact(t.type(prEventBase))

export type IPullRequestEvent = t.TypeOf<typeof PullRequestEvent>

export const PullRequestLabelEvent = t.exact(
  t.type({
    ...prEventBase,
    label: Label,
  }),
)

export type IPullRequestLabelEvent = t.TypeOf<typeof PullRequestLabelEvent>
