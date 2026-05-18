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
    path: 'users',
    loadComponent: () => import('./users/users').then((m) => m.Users),
  },
  {
    path: 'feedback',
    loadComponent: () =>
      import('./feedback/feedback').then((m) => m.Feedback),
  },
];
