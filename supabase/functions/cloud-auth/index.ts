import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cloud Auth Edge Function
 * Handles OAuth URL generation and Token Exchange for Cloud Providers.
 *
 * REQUIRED ENV VARS:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - MICROSOFT_CLIENT_ID
 * - MICROSOFT_CLIENT_SECRET
 * - REDIRECT_URI (The URL of this function or a dedicated callback handler)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, provider, code } = await req.json()

    if (action === 'get_auth_url') {
      let url = ''
      const redirectUri = Deno.env.get('REDIRECT_URI') || 'https://clipper-os.supabase.co/functions/v1/cloud-auth-callback'

      if (provider === 'Google Drive') {
        const root = 'https://accounts.google.com/o/oauth2/v2/auth'
        const options = {
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || 'PLACEHOLDER_CLIENT_ID',
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        }
        url = `${root}?${new URLSearchParams(options).toString()}`
      } else if (provider === 'OneDrive') {
        const root = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
        const options = {
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID') || 'PLACEHOLDER_CLIENT_ID',
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'files.readwrite offline_access user.read',
          response_mode: 'query',
        }
        url = `${root}?${new URLSearchParams(options).toString()}`
      }

      return new Response(JSON.stringify({ url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'exchange_token') {
      // Structure for token exchange once code is received from frontend/callback
      // This will store tokens in a secure table 'cloud_tokens' linked to the user_id
      return new Response(JSON.stringify({ success: true, message: 'Token exchange structure ready. Requires Client Secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
