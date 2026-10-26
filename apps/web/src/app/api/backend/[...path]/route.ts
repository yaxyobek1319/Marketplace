import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import routes from '@/lib/api-routes.json';
export const runtime = 'nodejs';
const base = (process.env.MARKETPLACE_API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
const refreshing = new Map<string, Promise<Tokens | null>>();
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
function save(response: NextResponse, tokens: Tokens) {
  response.cookies.set('mp_access', tokens.accessToken, {
    ...cookieOptions,
    maxAge: tokens.expiresIn,
  });
  response.cookies.set('mp_refresh', tokens.refreshToken, { ...cookieOptions, maxAge: 30 * 86400 });
}
function clear(response: NextResponse) {
  response.cookies.set('mp_access', '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set('mp_refresh', '', { ...cookieOptions, maxAge: 0 });
}
async function refresh(token: string) {
  const key = createHash('sha256').update(token).digest('hex');
  const existing = refreshing.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const r = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    return r.ok ? ((await r.json()) as Tokens) : null;
  })();
  refreshing.set(key, pending);
  void pending
    .finally(() => {
      setTimeout(() => refreshing.delete(key), 5000).unref();
    })
    .catch(() => {});
  return pending;
}
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const path = parts.join('/');
  const permitted = routes.some(
    (r) =>
      r.method === request.method &&
      new RegExp(
        '^' +
          r.path
            .replace('/api/v1/', '')
            .split('/')
            .map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
            .join('/') +
          '$',
      ).test(path),
  );
  if (
    !permitted ||
    parts.some((p) => p === '.' || p === '..' || p.includes('\\') || /[/?#]/.test(p))
  )
    return NextResponse.json({ message: 'Yo‘l topilmadi' }, { status: 404 });
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !==
      (process.env.WEB_PUBLIC_ORIGIN ??
        `${request.nextUrl.protocol}//${request.headers.get('host')}`)
  )
    return NextResponse.json({ message: 'So‘rov manbasi noto‘g‘ri' }, { status: 403 });
  try {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 11 * 1024 * 1024)
      return NextResponse.json({ message: 'Fayl juda katta' }, { status: 413 });
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 11 * 1024 * 1024)
      return NextResponse.json({ message: 'Fayl juda katta' }, { status: 413 });
    const access = request.cookies.get('mp_access')?.value,
      refreshToken = request.cookies.get('mp_refresh')?.value;
    const send = (token?: string) =>
      fetch(`${base}/${path}${request.nextUrl.search}`, {
        method: request.method,
        headers: {
          ...(request.headers.get('content-type')
            ? { 'content-type': request.headers.get('content-type')! }
            : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
    let result = await send(access),
      tokens: Tokens | null = null;
    if (
      result.status === 401 &&
      refreshToken &&
      !['auth/staff/login', 'auth/otp/verify', 'auth/login', 'auth/register'].includes(path)
    ) {
      tokens = await refresh(refreshToken);
      if (tokens) result = await send(tokens.accessToken);
    }
    const isLogin = ['auth/staff/login', 'auth/otp/verify', 'auth/login', 'auth/register'].includes(
      path,
    );
    if (isLogin && result.ok) {
      const value = (await result.json()) as Tokens;
      const response = NextResponse.json({ authenticated: true });
      save(response, value);
      return response;
    }
    const response = new NextResponse(await result.arrayBuffer(), {
      status: result.status,
      headers: {
        'content-type': result.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
        ...(result.headers.get('content-disposition')
          ? { 'content-disposition': result.headers.get('content-disposition')! }
          : {}),
      },
    });
    if (tokens) save(response, tokens);
    if (path === 'auth/logout-all' || result.status === 401) clear(response);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'Server bilan aloqa yo‘q. Keyinroq qayta urinib ko‘ring.' },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
