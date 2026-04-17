import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ────────────────────────────────────────────────────────────────────
// Set CORS_ALLOWED_ORIGINS in Edge Function secrets as a comma-separated list.
// Example: "https://your-app.com,http://localhost:5173,capacitor://localhost"
// If empty, all origins are rejected.
const ALLOWED_ORIGINS = (Deno.env.get('CORS_ALLOWED_ORIGINS') || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ''
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// ─── Encryption (AES-256-GCM) ────────────────────────────────────────────────
// Set TOKEN_ENCRYPTION_KEY in secrets as a base64-encoded 32-byte key.
// Generate one with: openssl rand -base64 32
async function getEncryptionKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!raw) return null
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptToken(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  return `${ivB64}:${ctB64}`
}

// ─── Main ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Reject cross-origin requests from unlisted origins
  if (req.headers.has('Origin') && !corsHeaders['Access-Control-Allow-Origin']) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { action, provider, code, state: clientState, redirect_uri } = await req.json()

    // ── get_auth_url ──────────────────────────────────────────────────────────
    if (action === 'get_auth_url') {
      const state = crypto.randomUUID()
      const redirectUri = redirect_uri || Deno.env.get('CLOUD_AUTH_REDIRECT_URI')

      if (!redirectUri) {
        return new Response(JSON.stringify({ error: 'CLOUD_AUTH_REDIRECT_URI not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Persist state server-side for CSRF validation on exchange
      const { error: stateError } = await supabaseClient
        .from('oauth_states')
        .insert({ user_id: user.id, state, provider })

      if (stateError) {
        console.error('[cloud-auth] Failed to persist oauth state:', stateError)
        return new Response(JSON.stringify({ error: 'Internal error generating auth state' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let url = ''
      if (provider === 'Google Drive') {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')

        const root = 'https://accounts.google.com/o/oauth2/v2/auth'
        const options = {
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
          state,
        }
        url = `${root}?${new URLSearchParams(options).toString()}`
      } else if (provider === 'OneDrive') {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
        if (!clientId) throw new Error('MICROSOFT_CLIENT_ID not configured')

        const root = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
        const options = {
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'files.readwrite offline_access user.read',
          response_mode: 'query',
          state,
        }
        url = `${root}?${new URLSearchParams(options).toString()}`
      }

      return new Response(JSON.stringify({ url, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── exchange_token ────────────────────────────────────────────────────────
    if (action === 'exchange_token') {
      if (!code) throw new Error('Missing OAuth code')
      if (!clientState) throw new Error('Missing OAuth state')

      // Validate state server-side (CSRF check)
      const { data: storedState, error: stateErr } = await supabaseClient
        .from('oauth_states')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('state', clientState)
        .eq('provider', provider)
        .single()

      if (stateErr || !storedState) {
        return new Response(JSON.stringify({ error: 'Invalid or expired OAuth state' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check expiry
      if (new Date(storedState.expires_at) < new Date()) {
        await supabaseClient.from('oauth_states').delete().eq('id', storedState.id)
        return new Response(JSON.stringify({ error: 'OAuth state has expired. Please try connecting again.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Consume state (one-time use)
      await supabaseClient.from('oauth_states').delete().eq('id', storedState.id)

      const redirectUri = redirect_uri || Deno.env.get('CLOUD_AUTH_REDIRECT_URI')
      let tokenResponse: Response | undefined

      if (provider === 'Google Drive') {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credentials missing', details: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set' }), {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri!, grant_type: 'authorization_code' }),
        })
      } else if (provider === 'OneDrive') {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
        const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')
        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Credentials missing', details: 'MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set' }), {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri!, grant_type: 'authorization_code' }),
        })
      }

      if (tokenResponse && tokenResponse.ok) {
        const tokens = await tokenResponse.json()

        // Encrypt tokens at rest (P2.2)
        const encKey = await getEncryptionKey()
        let accessToken = tokens.access_token
        let refreshToken = tokens.refresh_token
        if (encKey) {
          accessToken = await encryptToken(accessToken, encKey)
          if (refreshToken) refreshToken = await encryptToken(refreshToken, encKey)
        } else {
          console.warn('[cloud-auth] TOKEN_ENCRYPTION_KEY not set — tokens stored in plaintext')
        }

        const { error: dbError } = await supabaseClient
          .from('cloud_tokens')
          .upsert({
            user_id: user.id,
            provider,
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, provider' })

        if (dbError) throw dbError

        return new Response(JSON.stringify({ success: true, provider }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        const errData = await tokenResponse?.json()
        return new Response(JSON.stringify({ error: 'Token exchange failed', details: errData }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
