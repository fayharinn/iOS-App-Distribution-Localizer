/**
 * Cloudflare Worker to proxy App Store Connect and Google Play API requests
 * This bypasses CORS restrictions in production
 */

const ASC_API_BASE = 'https://api.appstoreconnect.apple.com'
const GP_API_BASE = 'https://androidpublisher.googleapis.com'

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
        }
      })
    }

    const path = url.pathname
    let targetUrl

    // Route to appropriate API based on path
    if (path.startsWith('/androidpublisher/')) {
      // Google Play API
      targetUrl = `${GP_API_BASE}${path}${url.search}`
    } else {
      // Default to App Store Connect API
      targetUrl = `${ASC_API_BASE}${path}${url.search}`
    }

    try {
      const contentType = request.headers.get('Content-Type')
      const headers = {
        'Authorization': request.headers.get('Authorization'),
      }
      
      // Preserve original Content-Type for image uploads etc.
      if (contentType) {
        headers['Content-Type'] = contentType
      }

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined,
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        }
      })
    }
  }
}
