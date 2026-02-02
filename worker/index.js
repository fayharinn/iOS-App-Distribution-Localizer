/**
 * Cloudflare Worker to proxy App Store Connect API requests
 * This bypasses CORS restrictions in production
 */

const ASC_API_BASE = 'https://api.appstoreconnect.apple.com'

// Allowed origins
const ALLOWED_ORIGINS = [
  'https://localizer.fayhe.com',
  'https://xcstrings-localizer.pages.dev'
]

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin')
    const url = new URL(request.url)

    // Validate origin
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Origin not allowed'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

    // Show info page for root path
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({
        status: 'running'
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
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          // NOTE: 'Access-Control-Allow-Credentials' is only needed if your frontend uses
          // fetch() with { credentials: 'include' }. Currently not required for this app.
          // Uncomment if you get CORS errors when saving to App Store Connect:
          // 'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        }
      })
    }

    // Check for Authorization header
    if (!request.headers.get('Authorization')) {
      return new Response(JSON.stringify({
        error: 'Missing Authorization header'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          // 'Access-Control-Allow-Credentials': 'true',
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
          'Access-Control-Allow-Origin': corsOrigin,
          // 'Access-Control-Allow-Credentials': 'true',
        },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
          // 'Access-Control-Allow-Credentials': 'true',
        }
      })
    }
  }
}
