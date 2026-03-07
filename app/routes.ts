import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/_index.tsx'),
  route('history', 'routes/history.tsx'),
  route('login', 'routes/login.tsx'),
  route('offline', 'routes/offline.tsx'),
] satisfies RouteConfig;
