import type { FeatureManifest } from '../../core/feature'

export default {
  id: 'workspace',
  order: 150,
  contracts: [],
  pref: 'workspaceView',
  stylesheets: [{ file: 'workspace.css', rank: 120 }],
  settingsRows: [{
    tab: 'sidebar',
    rank: 30,
    pref: 'workspaceView',
    title: 'workspaceTitle',
    desc: 'workspaceDesc',
  }],
  cases: ['switches', 'popovers'],
  description: {
    zh: {
      title: '进行中 / 已归档',
      text: '侧栏的工作区分成「进行中」与「已归档」两档；已归档是一张平铺的列表，每一行可以恢复或删除。',
    },
    en: {
      title: 'In progress / Archived',
      text: 'The sidebar\'s workspace section splits into In progress and Archived; Archived is one flat list whose rows can be restored or deleted.',
    },
  },
} satisfies FeatureManifest
