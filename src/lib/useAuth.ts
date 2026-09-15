import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session, or create an anonymous one.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setLoading(false);
      } else {
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error) console.error('Anonymous sign-in failed:', error.message);
          setUser(data?.user ?? null);
          setLoading(false);
        });
      }
    });

    // Keep user state in sync if auth changes later (e.g. upgrading to a real account).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { user, loading };
}