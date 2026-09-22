import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { readMigrationMarker, clearMigrationMarker } from './account';
import { migrateLocalData } from './accountMigration';
import { db, wipeUserData } from './db';

// After signing in to an existing account, checks whether there are chats from a guest session
// on this device. If there are, asks whether to add them to the account — yes merges them in,
// no burns them from this device so they aren't left behind, unreachable, forever.
export function useAccountMigration(user: User | null) {
  const [notice, setNotice] = useState('');

  const userId = user?.id ?? null;
  // Only a real account (not a guest) can receive the guest's chats.
  const isRealAccount = user?.is_anonymous === false;

  useEffect(() => {
    if (!userId || !isRealAccount) return;
    const guestId = readMigrationMarker();
    if (!guestId) return;
    if (guestId === userId) {
      clearMigrationMarker(); // same ID: it was an upgrade, there is nothing to move
      return;
    }

    (async () => {
      const chatCount = await db.conversations.where('userId').equals(guestId).count();
      clearMigrationMarker();
      if (chatCount === 0) return; // nothing from the guest session to ask about

      const wantsMerge = window.confirm(
        `You have ${chatCount} chat${chatCount === 1 ? '' : 's'} from this device's guest session. ` +
          `Add ${chatCount === 1 ? 'it' : 'them'} to your account?\n\n` +
          `Choosing Cancel deletes ${chatCount === 1 ? 'it' : 'them'} from this device instead.`
      );

      if (wantsMerge) {
        const moved = await migrateLocalData(guestId, userId);
        setNotice(
          `Signed in. ${moved} chat${moved === 1 ? '' : 's'} from this device ${moved === 1 ? 'was' : 'were'} added to your account.`
        );
      } else {
        await wipeUserData(guestId);
      }
    })().catch((err) => console.error('Handling guest chats failed:', err));
  }, [userId, isRealAccount]);

  return { notice, clearNotice: () => setNotice('') };
}