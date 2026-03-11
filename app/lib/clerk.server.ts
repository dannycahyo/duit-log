import { createClerkClient } from '@clerk/react-router/api.server';

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error('CLERK_SECRET_KEY environment variable is not set or is empty.');
}

export const clerkClient = createClerkClient({ secretKey });
