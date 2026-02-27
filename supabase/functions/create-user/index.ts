/**
 * create-user
 *
 * Kreira korisnika putem Admin API-ja s email_confirm: true – odmah može prijaviti se
 * bez potvrde e-maila. Koristi se umjesto signUp kada je "Confirm email" uključen u Supabaseu.
 *
 * Poziv bez JWT (verify_jwt = false) jer korisnik još nije prijavljen.
 *
 * Deploy: supabase functions deploy create-user
 * Config: supabase/config.toml [functions.create-user] verify_jwt = false
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const { email, password, name } = await req.json()
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'email i lozinka su obavezni' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Lozinka mora imati najmanje 6 znakova' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data, error } = await admin.auth.admin.createUser({
      email: trimmedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: (name && typeof name === 'string' ? name.trim() : null) || trimmedEmail.split('@')[0] },
    })

    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      const code = (error as { code?: string }).code ?? ''
      if (code === 'user_already_exists' || msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return new Response(
          JSON.stringify({ error: 'USER_EXISTS', message: 'Korisnik s ovom e-mail adresom već postoji.' }),
          { status: 409, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: error.message || 'Greška pri kreiranju korisnika' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, userId: data.user?.id }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('create-user error:', e)
    return new Response(
      JSON.stringify({ error: 'Interna greška' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
