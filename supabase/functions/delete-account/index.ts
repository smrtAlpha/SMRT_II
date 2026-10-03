// Only these websites may call this function from a browser.
const ALLOWED_ORIGINS = [
  'https://smrt-ii.vercel.app',
  'https://smrt-ii-git-main-smartalphas.vercel.app',
  'http://localhost:5173', // npm run dev
  'http://localhost:4173', // npm run preview
];

function corsFor(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Everything the app syncs to the cloud, children first. These tables already delete themselves when
// the user is deleted (the schema cascades), but clearing them explicitly means a table that is
// missing that rule can't make the account deletion fail half-way.
const USER_TABLES = ['messages', 'attachments', 'conversations', 'documents', 'knowledge_packs', 'user_memory'];

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Please sign in first.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // The service role key lets this function delete a login account. It exists only here on the
    // server (Supabase adds it automatically) and is never sent to the browser.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    // Who is asking? Taken from the login token — never from anything the browser sends in the body,
    // so nobody can delete someone else's account.
    const whoRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!whoRes.ok) return json({ error: 'Your session has expired. Please sign in again.' }, 401);
    const user = await whoRes.json();
    if (!user?.id) return json({ error: 'Your session has expired. Please sign in again.' }, 401);

    if (user.is_anonymous) {
      return json({ error: "Guest sessions don't have an account to delete." }, 400);
    }

    // A second safety check on top of the confirmation in the app.
    const body = await req.json().catch(() => null);
    if (body?.confirm !== 'DELETE') {
      return json({ error: 'Deletion was not confirmed.' }, 400);
    }

    for (const table of USER_TABLES) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      if (!res.ok) {
        console.error(`Clearing ${table} failed:`, res.status, await res.text().catch(() => ''));
        return json({ error: 'Could not remove your data. Nothing was deleted. Please try again.' }, 500);
      }
    }

    // Best effort: a developer-exemption row, if this account had one.
    await fetch(`${supabaseUrl}/rest/v1/rate_limit_exempt?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    }).catch(() => {});

    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (!deleteRes.ok) {
      console.error('Deleting the login account failed:', deleteRes.status, await deleteRes.text().catch(() => ''));
      return json({ error: 'Could not delete the account. Please try again.' }, 500);
    }

    // Best effort: remove chats that now have nobody left in them. (Messages this person sent in
    // chats that still have other people stay, shown as coming from a deleted user.)
    await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_empty_chats`, {
      method: 'POST',
      headers: adminHeaders,
      body: '{}',
    }).catch(() => {});

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('delete-account crashed:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});