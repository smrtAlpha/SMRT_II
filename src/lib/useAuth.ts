import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { tokenSaysGuest } from './jwt';
import type { Session, User } from '@supabase/supabase-js';

// Right after a guest turns into a real account, their login token can still say "guest" for up to an
// hour, which would keep the low request limits. Getting a fresh token fixes that straight away.
async function refreshIfStale(session: Session): Promise<Session> {
  if (session.user.is_anonymous === false && tokenSaysGuest(session.access_token)) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return data.session;
  }
  return session;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Everyone always has a login. New visitors (and people who just signed out) start as a guest.
    async function becomeGuest() {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) console.error('Guest sign-in failed:', error.message);
      if (active) {
        setUser(data?.user ?? null);
        setLoading(false);
      }
    }

    async function start() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        const fresh = await refreshIfStale(session);
        if (!active) return;
        setUser(fresh.user);
        setLoading(false);
      } else {
        await becomeGuest();
      }
    }
    start();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Note: don't wait on other Supabase calls directly inside this callback. setTimeout avoids a freeze.
      if (event === 'SIGNED_OUT') {
        setLoading(true);
        setTimeout(() => {
          becomeGuest();
        }, 0);
        return;
      }
      if (!session) return;
      setUser(session.user);
      if (session.user.is_anonymous === false && tokenSaysGuest(session.access_token)) {
        setTimeout(() => {
          supabase.auth.refreshSession();
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}