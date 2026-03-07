import {
  Form,
  redirect,
  useActionData,
  useNavigation,
} from 'react-router';
import type { Route } from './+types/login';
import { isAuthenticated, login } from '~/lib/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthenticated(request)) {
    throw redirect('/');
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const passcode = formData.get('passcode') as string;
  return login(request, passcode);
}

export default function Login() {
  const actionData = useActionData<typeof action>() as
    | { error?: string }
    | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-xs">
        <h1 className="mb-8 text-center text-2xl font-bold tracking-tight text-slate-900">
          DuitLog
        </h1>
        <Form method="post" className="flex flex-col gap-4">
          <label htmlFor="passcode" className="sr-only">
            Passcode
          </label>
          <input
            type="password"
            id="passcode"
            name="passcode"
            placeholder="Enter passcode"
            autoFocus
            required
            className="w-full rounded-lg border border-slate-500 px-4 py-3 text-center text-lg tracking-widest text-slate-900 placeholder:text-slate-500 focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
          {actionData?.error && (
            <p className="text-center text-sm text-red-600">
              {actionData.error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Checking...' : 'Enter'}
          </button>
        </Form>
      </div>
    </main>
  );
}
