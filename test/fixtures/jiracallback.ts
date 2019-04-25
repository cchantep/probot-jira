import { ICallback, IIssueCallback } from '../../src/model/jira'
import { issue5 } from './jiraissue'

export const callback1: ICallback = {
  payload: {
    timestamp: 1556998112278,
    webhookEvent: 'jira:issue_updated',
    user: {
      self: 'https://foo.atlassian.net/rest/api/2/user?accountId=557058%3A2c859783-43e3-46eb-b3bd-65a290d4a76f',
      name: 'firstn1.lastn1',
      key: 'firstn1.lastn1',
      emailAddress: 'firstn1.lastn1@company.com',
      displayName: 'Firstn1 Lastn1',
    }
  }
}

export const issueCallback1: IIssueCallback = {
  payload: {
    ...callback1.payload,
    issue: issue5
  }
}
