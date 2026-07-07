import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { STAFF_COOKIE_NAME, signStaffSession, verifyStaffSession } from "@/lib/staff-session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_WINDOW_SEC = LOGIN_WINDOW_MS / 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

function withCors(headers?: HeadersInit): HeadersInit {
  return { ...CORS_HEADERS, ...headers };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`staff_login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  const rlHeaders = rateLimitHeaders(rl, LOGIN_LIMIT, LOGIN_WINDOW_SEC);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, headers: withCors(rlHeaders) },
    );
  }

  const secret = process.env.STAFF_COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500, headers: withCors(rlHeaders) },
    );
  }
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: withCors(rlHeaders) },
    );
  }
  const u = process.env.STAFF_USERNAME ?? "staff";
  const p = process.env.STAFF_PASSWORD ?? "staff12345678";
  if (body.username !== u || body.password !== p) {
    return NextResponse.json(
      { ok: false, error: "invalid_credentials" },
      { status: 401, headers: withCors(rlHeaders) },
    );
  }
  const token = signStaffSession(body.username, secret);
  const jar = await cookies();
  jar.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return NextResponse.json(
    { ok: true, token, user: body.username },
    { headers: withCors(rlHeaders) },
  );
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE_NAME);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const secret = process.env.STAFF_COOKIE_SECRET;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const user = verifyStaffSession(auth.slice(7), secret);
    return NextResponse.json(
      { ok: Boolean(user), user: user ?? null },
      { headers: CORS_HEADERS },
    );
  }
  const jar = await cookies();
  const user = verifyStaffSession(jar.get(STAFF_COOKIE_NAME)?.value, secret);
  return NextResponse.json(
    { ok: Boolean(user), user: user ?? null },
    { headers: CORS_HEADERS },
  );
}
