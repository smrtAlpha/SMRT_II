import { Download } from 'lucide-react';
import { usePwaInstall } from '../lib/usePwaInstall';

export default function InstallButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <button
      onClick={promptInstall}
      className="mb-2 flex items-center gap-1.5 self-start rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
    >
      <Download size={14} />
      Install SMRT
    </button>
  );
}