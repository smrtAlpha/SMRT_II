import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { readMigrationMarker, clearMigrationMarker } from './account';
import { migrateLocalData } from './accountMigration';

// After signing in to an existing account, moves the chats made on this device as a guest over to it.
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

    migrateLocalData(guestId, userId)
      .then((chats) => {
        clearMigrationMarker();
        if (chats > 0) {
          setNotice(
            `Signed in. ${chats} chat${chats === 1 ? '' : 's'} from this device ${chats === 1 ? 'was' : 'were'} added to your account.`
          );
        }
      })
      .catch((err) => console.error('Moving guest chats failed:', err));
  }, [userId, isRealAccount]);

  return { notice, clearNotice: () => setNotice('') };
}