import ChatWindow from './components/ChatWindow';
import InstallButton from './components/InstallButton';
import { useAuth } from './lib/useAuth';
import { useOnlineStatus } from './lib/useOnlineStatus';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();

  if (loading) {
    return <div className="app"><p>Starting SMRT...</p></div>;
  }

  return (
    <div className="app">
      <h1>SMRT</h1>
      {!isOnline && <div className="offline-banner">You're offline — using cached history</div>}
      <InstallButton />
      <ChatWindow userId={user?.id ?? ''} />
      <p className="user-id">Session: {user?.id.slice(0, 8) ?? 'none'}</p>
    </div>
  );
}

export default App;