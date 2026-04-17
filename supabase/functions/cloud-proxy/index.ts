import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ────────────────────────────────────────────────────────────────────
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

// ─── Decryption (AES-256-GCM) ────────────────────────────────────────────────
async function getEncryptionKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!raw) return null
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function decryptToken(encrypted: string, key: CryptoKey): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(':')
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted token format')
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0))
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

async function resolveToken(stored: string, key: CryptoKey | null): Promise<string> {
  if (!key) return stored // plaintext fallback (no key configured)
  // Detect if value is encrypted (contains ':' separator between two base64 segments)
  if (stored.includes(':')) {
    try { return await decryptToken(stored, key) } catch { return stored }
  }
  return stored // legacy plaintext value
}

// ─── Main ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const { action, provider, folderId, fileId, newFolderId } = await req.json()

    const { data: credentials, error: credError } = await supabaseClient
      .from('cloud_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    if (credError || !credentials) {
      return new Response(JSON.stringify({ error: 'Provider not connected', provider }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const encKey = await getEncryptionKey()
    let accessToken = await resolveToken(credentials.access_token, encKey)
    const refreshToken = credentials.refresh_token
      ? await resolveToken(credentials.refresh_token, encKey)
      : null

    // Token Refresh Logic
    const expiresAt = new Date(credentials.expires_at).getTime()
    if (expiresAt < Date.now() + 60000) {
      console.log(`[Proxy] Token expired for ${provider}, refreshing...`)

      let refreshUrl = ''
      let clientId = ''
      let clientSecret = ''

      if (provider === 'Google Drive') {
        refreshUrl = 'https://oauth2.googleapis.com/token'
        clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
        clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
      } else if (provider === 'OneDrive') {
        refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!
        clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
      }

      const refreshResponse = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken ?? '',
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      })

      if (refreshResponse.ok) {
        const newTokens = await refreshResponse.json()
        accessToken = newTokens.access_token

        // Re-encrypt refreshed token before storing
        const storedToken = encKey ? await encryptToken(accessToken, encKey) : accessToken
        await supabaseClient.from('cloud_tokens').update({
          access_token: storedToken,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', credentials.id)
      } else {
        return new Response(JSON.stringify({ error: 'Failed to refresh token', provider }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Provider specific API calls
    if (action === 'list_files' || action === 'list_folders') {
      if (provider === 'Google Drive') {
        const q = action === 'list_folders'
          ? "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
          : `'${folderId || 'root'}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink,size,durationMillis,webContentLink)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const data = await response.json()

        return new Response(JSON.stringify({
          success: true,
          files: data.files?.map((f: any) => ({
            id: f.id, name: f.name, thumbnail: f.thumbnailLink,
            duration: f.durationMillis ? new Date(parseInt(f.durationMillis)).toISOString().substr(14, 5) : '00:00',
            link: f.webContentLink,
          })) || [],
          folders: data.files?.map((f: any) => ({ id: f.id, name: f.name })) || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (provider === 'OneDrive') {
        const url = folderId
          ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
          : `https://graph.microsoft.com/v1.0/me/drive/root/children`

        const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        const data = await response.json()
        const items = data.value || []

        return new Response(JSON.stringify({
          success: true,
          files: action === 'list_files' ? items.filter((i: any) => !i.folder).map((i: any) => ({
            id: i.id, name: i.name,
            thumbnail: i.thumbnails?.[0]?.medium?.url,
            duration: i.video?.duration ? new Date(i.video.duration).toISOString().substr(14, 5) : '00:00',
            link: i['@microsoft.graph.downloadUrl'],
          })) : [],
          folders: action === 'list_folders' ? items.filter((i: any) => i.folder).map((i: any) => ({ id: i.id, name: i.name })) : [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (action === 'move_file') {
      if (!fileId || !newFolderId) throw new Error('Missing fileId or newFolderId')

      if (provider === 'Google Drive') {
        const getFile = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const fileData = await getFile.json()
        const oldParents = (fileData.parents || []).join(',')

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newFolderId}&removeParents=${oldParents}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        return new Response(JSON.stringify({ success: response.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (provider === 'OneDrive') {
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentReference: { id: newFolderId } }),
        })
        return new Response(JSON.stringify({ success: response.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action or provider' }), {
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

// ─── Encryption helper (also needed in proxy for re-encrypting refreshed tokens) ──
async function encryptToken(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  return `${ivB64}:${ctB64}`
}
