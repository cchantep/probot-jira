import { IHook } from '../../src/model/jira'

export const hooks1: ReadonlyArray<IHook> = [
   {
      name: "Slack Webhook",
      url: "https://zengularity.slack.com/services/hooks/jira?token=foo",
      events: [
         "jira:issue_updated",
         "jira:issue_created",
         "jira:issue_deleted",
         "jira:worklog_updated"
      ],
      filters: {
        'issue-related-events-section': "project = \"PRJ1\""
      },
      self: 'https://zenstudio.atlassian.net/rest/webhooks/latest/webhook/1',
      enabled: true
   },
   {
      name: "Test3",
      url: "https://zengularity.slack.com/services/hooks/jira?token=bar",
      events: [
         "jira:issue_updated",
         "jira:issue_created"
      ],
      filters: { 'issue-related-events-section': "project = \"Test\"" },
      self: 'https://zenstudio.atlassian.net/rest/webhooks/latest/webhook/2',
      enabled: true
   },
   {
      name: "EOL - Zlack",
      url: "http://zlack.herokuapp.com/hooks/jira?channel=eol",
      events: [
         "jira:issue_updated",
         "jira:issue_created",
         "jira:issue_deleted",
         "jira:worklog_updated"
      ],
      filters: { 'issue-related-events-section': "project = \"Test2\"" },
      self: 'https://zenstudio.atlassian.net/rest/webhooks/latest/webhook/3',
      enabled: true
   },
   {
      name: "Freshdesk webhook",
      url: "https://srv.freshdesk.com/integrations/jira_issue/notify?auth_key=lorem",
      events: [
         "jira:issue_updated"
      ],
      filters: { 'issue-related-events-section': "" },
      self: 'https://zenstudio.atlassian.net/rest/webhooks/latest/webhook/4',
      enabled: true
   },
   {
      name: "PRO",
      url: "https://url.io",
      events: [
         "worklog_created",
         "issuelink_created",
         "comment_updated",
         "attachment_created",
         "comment_deleted",
         "jira:issue_updated",
         "comment_created",
         "jira:issue_created",
         "issuelink_deleted",
         "jira:issue_deleted",
         "worklog_deleted",
         "worklog_updated",
         "attachment_deleted"
      ],
      filters: {
        'issue-related-events-section': "project = \"CRPCEN - Déclaration\" OR project = \"PRO\" OR project = \"PRK\" OR project = \"X\" OR project = \"Y\""
      },
      self: 'https://zenstudio.atlassian.net/rest/webhooks/latest/webhook/5',
      enabled: true
   }
]
