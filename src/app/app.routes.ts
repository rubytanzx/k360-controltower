import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'assets',
    loadComponent: () => import('./assets/assets').then((m) => m.Assets),
  },
  {
    path: 'assets/collection/:slug',
    loadComponent: () =>
      import('./assets/collection-detail/collection-detail').then((m) => m.CollectionDetail),
  },
  {
    path: 'assets/agent/:slug',
    loadComponent: () =>
      import('./assets/agent-detail/agent-detail').then((m) => m.AgentDetail),
  },
  {
    path: 'prompts',
    loadComponent: () =>
      import('./prompts/prompts').then((m) => m.Prompts),
  },
  {
    path: 'prompts/analysis',
    loadComponent: () =>
      import('./prompts/analysis/analysis').then((m) => m.Analysis),
  },
  {
    path: 'prompts/agents',
    loadComponent: () =>
      import('./prompts/agents/agents').then((m) => m.AgentsAnalysis),
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users').then((m) => m.Users),
  },
  {
    path: 'feedback',
    loadComponent: () =>
      import('./feedback/feedback').then((m) => m.Feedback),
  },
];
