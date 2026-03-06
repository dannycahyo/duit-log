import { createCookieSessionStorage, data, redirect } from "react-router";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "duitlog_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
  },
});

function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function login(
  request: Request,
  passcode: string,
): Promise<Response> {
  if (passcode === process.env.AUTH_PASSCODE) {
    const session = await getSession(request);
    session.set("authenticated", true);
    return redirect("/", {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
  }
  return data({ error: "Wrong passcode" }, { status: 401 }) as unknown as Response;
}

export async function requireAuth(request: Request): Promise<void> {
  const session = await getSession(request);
  if (session.get("authenticated") !== true) {
    throw redirect("/login");
  }
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const session = await getSession(request);
  return session.get("authenticated") === true;
}

export async function logout(request: Request): Promise<Response> {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
