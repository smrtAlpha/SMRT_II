import { useState } from 'react';
import { Upload } from 'lucide-react';
import { extractTextFromFile } from '../lib/extractText';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-pack`;

type Props = { userId: string };
type Status = 'idle' | 'extracting' | 'summarizing' | 'done' | 'error';

export default function KnowledgePackUpload({ userId }: Props) {
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!subject.trim()) {
      setErrorMsg('Give this knowledge pack a subject name first.');
      return;
    }

    setErrorMsg('');
    setStatus('extracting');

    try {
      const rawText = await extractTextFromFile(file);

      setStatus('summarizing');
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!res.ok) throw new Error(`Summarization failed (${res.status})`);
      const { summary } = await res.json();

      await db.knowledgePacks.add({
        id: crypto.randomUUID(),
        userId,
        subject: subject.trim(),
        sourceFileName: file.name,
        summary,
        timestamp: Date.now(),
      });

      setStatus('done');
    } catch (err) {
      console.error('Knowledge pack processing failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  const busy = status === 'extracting' || status === 'summarizing';

  return (
    <div className="mb-2 flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Upload size={14} />
        <span>Add a knowledge pack</span>
      </div>
      <input
        type="text"
        placeholder="Subject (e.g. Organic Chemistry)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={busy}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
      />
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFile}
        disabled={busy}
        className="text-sm disabled:opacity-50"
      />
      {status === 'extracting' && <p className="text-slate-500">Reading document...</p>}
      {status === 'summarizing' && <p className="text-slate-500">Condensing into a knowledge pack (can take a moment for large files)...</p>}
      {status === 'done' && <p className="text-green-700">✅ Knowledge pack saved — available offline.</p>}
      {status === 'error' && <p className="text-red-600">{errorMsg}</p>}
    </div>
  );
}