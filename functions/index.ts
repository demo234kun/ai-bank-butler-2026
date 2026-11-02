/**
 * Qoder Site Edge Function：把同源 /api/* 请求转发到产品后端。
 *
 * 站点本身只托管前端静态文件；真正的 Agent、账本、审计与安全逻辑
 * 运行在产品后端。代理仅放行 /api/*，目标地址固定，不接受请求方指定 URL。
 *
 * 后端换地址时只需更新 APP_ORIGIN（平台 Secret 或下方默认值）。
 */

const DEFAULT_APP_ORIGIN = 'https://theology-confirmed-ban-hay.trycloudflare.com';

const APP_ORIGIN = (
  (typeof Deno !== 'undefined' ? Deno.env.get('APP_ORIGIN') : undefined) ?? DEFAULT_APP_ORIGIN
).replace(/\/+$/, '');

const FUNCTION_PREFIX = '/functions/v1/app';

const REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'content-type',
  'cookie',
  'origin',
  'referer',
  'user-agent',
  'x-requested-with',
];

const STRIP_RESPONSE_HEADERS = [
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** 网关可能传入完整逻辑路径，也可能已剥离函数前缀；取第一个 /api/ 之后的部分。 */
function upstreamPath(pathname: string): string {
  const apiIndex = pathname.indexOf('/api/');
  if (apiIndex >= 0) return pathname.slice(apiIndex);
  let path = pathname;
  if (path.startsWith(FUNCTION_PREFIX)) path = path.slice(FUNCTION_PREFIX.length) || '/';
  if (path === '/app') path = '/';
  if (path.startsWith('/app/')) path = path.slice('/app'.length);
  return path.startsWith('/') ? path : `/${path}`;
}

export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);

  if (!path.startsWith('/api/')) {
    return json(404, { ok: false, code: 'NOT_FOUND', message: '仅代理 /api 接口', received: url.pathname });
  }
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: '不支持的请求方法' });
  }

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // 让后端按访问者而非代理出口做限流；站点域名同时用于 WebAuthn RP ID。
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  headers.set('host', url.host);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(90_000),
  };
  // Node 的 fetch 对流式请求体要求 duplex；Deno 不需要。
  if (typeof Deno === 'undefined') init.duplex = 'half';

  try {
    const upstream = await fetch(`${APP_ORIGIN}${path}${url.search}`, init);

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, name) => {
      const lower = name.toLowerCase();
      if (lower === 'set-cookie' || STRIP_RESPONSE_HEADERS.includes(lower)) return;
      responseHeaders.set(name, value);
    });
    responseHeaders.set('cache-control', 'no-store');

    const cookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : upstream.headers.get('set-cookie')
          ? [upstream.headers.get('set-cookie') as string]
          : [];
    for (const cookie of cookies) responseHeaders.append('set-cookie', cookie);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return json(502, {
      ok: false,
      code: 'UPSTREAM_UNAVAILABLE',
      message: '演示后端暂时不可达，请稍后重试',
    });
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handler);
}
