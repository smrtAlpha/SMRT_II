import { usePwaInstall } from '../lib/usePwaInstall';

export default function InstallButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <button className="install-button" onClick={promptInstall}>
      Install SMRT
    </button>
  );
}