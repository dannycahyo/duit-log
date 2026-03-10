import { type RouteConfig, index, route, layout } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  layout('routes/_app.tsx', [
    route('dashboard', 'routes/_app.dashboard.tsx'),
    route('history', 'routes/_app.history.tsx'),
    route('onboarding', 'routes/_app.onboarding.tsx'),
    route('settings', 'routes/_app.settings.tsx'),
  ]),
  route('offline', 'routes/offline.tsx'),
  route('api/sync', 'routes/api.sync.tsx'),
] satisfies RouteConfig;
