import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Share2 } from 'lucide-react';
import { inviteUrl } from '../lib/friends';
import type { Outcome } from '../lib/friends';
import { PRIMARY, SECONDARY } from './friendsUi';

type Props = {
  // Makes a new invite code on the server.
  create: () => Promise<Outcome<string>>;
  buttonLabel: string;
  hint: string;
  disabled?: boolean;
};

// "Make a link" → shows the link with Copy and Share buttons.
export default function InviteLinkBox({ create, buttonLabel, hint, disabled = false }: Props) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setBusy(true);
    setError('');
    const result = await create();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLink(inviteUrl(result.data));
    setCopied(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard access: let the person copy it by hand instead.
      window.prompt('Copy this link:', link);
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title: 'Join me on SMRT', url: link });
    } catch {
      // cancelled: nothing to do
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div>
      {!link ? (
        <button type="button" onClick={handleCreate} disabled={busy || disabled} className={`${SECONDARY} w-full`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          {buttonLabel}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs break-all text-slate-600 select-all">
            {link}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleCopy} className={`${PRIMARY} flex-1`}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {canShare && (
              <button type="button" onClick={handleShare} className={`${SECONDARY} flex-1`}>
                <Share2 size={16} />
                Share
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  );
}