// portalAuth.js — drop this file into src/ of each app
// Then call checkPortalAuth() at the top of main.jsx before rendering

const PORTAL_URL = 'https://portal.gtintl.com.ph'
const TOKEN_KEY = 'gt_portal_token'
const SECRET = import.meta.env.VITE_PORTAL_SECRET || 'gt-portal-secret-change-me'

async function verify(b64, sig) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const expected = await crypto.subtle.sign('HMAC', key, enc.encode(b64))
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return expectedB64 === sig
}

export async function checkPortalAuth() {
  // 1. If portal just launched us, grab token from URL and store it
  const params = new URLSearchParams(window.location.search)
  const urlToken = params.get('portal_token')
  if (urlToken) {
    localStorage.setItem(TOKEN_KEY, urlToken)
    // Clean URL without reload
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)
  }

  // 2. Validate stored token
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    window.location.href = PORTAL_URL
    return false
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    localStorage.removeItem(TOKEN_KEY)
    window.location.href = PORTAL_URL
    return false
  }

  const [b64, sig] = parts
  const valid = await verify(b64, sig)
  if (!valid) {
    localStorage.removeItem(TOKEN_KEY)
    window.location.href = PORTAL_URL
    return false
  }

  try {
    const payload = JSON.parse(atob(b64))
    if (Date.now() > payload.exp) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = PORTAL_URL
      return false
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    window.location.href = PORTAL_URL
    return false
  }

  return true
}
