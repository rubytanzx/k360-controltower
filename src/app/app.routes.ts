import { Routes } from '@angular/router';

const home = () => import('./home/home').then((m) => m.Home);

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: home },
  // Aliases — existing in-page routerLinks like routerLink="/assets" still work
  // and Home will scroll to the matching section based on the path segment.
  { path: 'assets', pathMatch: 'full', loadComponent: home },
  { path: 'prompts', pathMatch: 'full', loadComponent: home },
  { path: 'users', pathMatch: 'full', loadComponent: home },
  { path: 'feedback',     pathMatch: 'full', loadComponent: home },
  { path: 'performance',  pathMatch: 'full', loadComponent: home },
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
    path: 'prompts/analysis',
    loadComponent: () =>
      import('./prompts/analysis/analysis').then((m) => m.Analysis),
  },
];
