import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cloud Auth Edge Function
 * Handles OAuth URL generation and Token Exchange for Cloud Providers.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { action, provider, code, redirect_uri } = await req.json()

    if (action === 'get_auth_url') {
      const state = crypto.randomUUID()
      // Note: In a real flow, you should store 'state' in a DB to verify on callback

      let url = ''
      const redirectUri = redirect_uri || Deno.env.get('CLOUD_AUTH_REDIRECT_URI')

      if (!redirectUri) {
         return new Response(JSON.stringify({ error: 'CLOUD_AUTH_REDIRECT_URI not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

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
          state: state
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
          state: state
        }
        url = `${root}?${new URLSearchParams(options).toString()}`
      }

      return new Response(JSON.stringify({ url, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'exchange_token') {
      if (!code) throw new Error('Missing OAuth code')

      const redirectUri = redirect_uri || Deno.env.get('CLOUD_AUTH_REDIRECT_URI')
      let tokenResponse;

      if (provider === 'Google Drive') {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({
            error: 'Credentials missing',
            details: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in Edge Function secrets.'
          }), {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri!,
            grant_type: 'authorization_code',
          }),
        })
      } else if (provider === 'OneDrive') {
        const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
        const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')

        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({
            error: 'Credentials missing',
            details: 'MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set in Edge Function secrets.'
          }), {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri!,
            grant_type: 'authorization_code',
          }),
        })
      }

      if (tokenResponse && tokenResponse.ok) {
        const tokens = await tokenResponse.json()

        // Use service role key if you want to bypass RLS for token storage
        // Or ensure the user has permission to insert into 'cloud_tokens'
        const { error: dbError } = await supabaseClient
          .from('cloud_tokens')
          .upsert({
            user_id: user.id,
            provider,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString()
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
