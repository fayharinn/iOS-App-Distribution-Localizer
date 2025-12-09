/**
 * Cloudflare Worker to proxy App Store Connect API requests
 * This bypasses CORS restrictions in production
 */

const ASC_API_BASE = 'https://api.appstoreconnect.apple.com'

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '*'
    const url = new URL(request.url)

    // Show info page for root path
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({
        name: 'XCStrings Localizer Proxy',
        status: 'running',
        usage: 'This worker proxies requests to App Store Connect API. Use /v1/... endpoints with a valid JWT token.',
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      })
    }

    // Check for Authorization header
    if (!request.headers.get('Authorization')) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header',
        hint: 'This proxy requires a valid App Store Connect JWT token'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
        }
      })
    }

    const path = url.pathname
    const targetUrl = `${ASC_API_BASE}${path}${url.search}`

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Authorization': request.headers.get('Authorization'),
          'Content-Type': 'application/json',
        },
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': origin,
        },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
        }
      })
    }
  }
}
