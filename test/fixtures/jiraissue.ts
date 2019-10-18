import { IIssue } from '../../src/model/jira'

export const issue1: IIssue = {
  fields: {
    description: 'Bla bla bla bla bla',
    fixVersions: [
      {
        description: '',
        id: '26009',
        name: 'Release 1.3',
      },
    ],
    resolution: { name: 'Done' },
    status: { name: 'Prêt à livrer (MERGED)' },
    summary: 'Harmonisation CTAs on mobile',
  },
  key: 'PRJ-2179',
  id: '59649',
}

export const issue2: IIssue = {
  fields: {
    description: 'Bla bla bla bla bla',
    fixVersions: [
      {
        description: undefined, // !!
        id: '26009',
        name: 'Release 1.3',
      },
    ],
    resolution: { name: 'Done' },
    status: { name: 'Prêt à livrer (MERGED)' },
    summary: 'Harmonisation CTAs on mobile',
  },
  key: 'PRJ-2179',
  id: '59649',
}

export const issue3: IIssue = {
  fields: {
    description: 'Bla bla bla bla bla',
    fixVersions: [
      {
        description: '',
        id: '26009',
        name: 'Release 1.3',
      },
    ],
    resolution: null, // !!
    status: { name: 'Prêt à livrer (MERGED)' },
    summary: 'Harmonisation CTAs on mobile',
  },
  key: 'PRJ-2179',
  id: '59649',
}

export const issue4: IIssue = {
  fields: {
    description: null, // !!
    fixVersions: [
      {
        description: '',
        id: '26009',
        name: 'Release 1.3',
      },
    ],
    resolution: { name: 'Done' },
    status: { name: 'Prêt à livrer (MERGED)' },
    summary: 'Harmonisation CTAs on mobile',
  },
  key: 'PRJ-2179',
  id: '59649',
}

export const issue5: IIssue = {
  fields: {
    description: 'Bla bla bla bla bla bla lorem ipsum foo bar',
    fixVersions: [
      {
        description: undefined,
        id: '26007',
        name: 'Release 1.2',
      },
    ],
    resolution: { name: 'Done' },
    status: { name: 'DONE' },
    summary: 'HOTFIX - Affichage de la date édition pour un Article',
  },
  key: 'PRJ-2042',
  id: '59404',
}
