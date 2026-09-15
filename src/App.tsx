import ChatWindow from './components/ChatWindow';
import { useAuth } from './lib/useAuth';
import './App.css';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="app"><p>Starting SMRT...</p></div>;
  }

  return (
    <div className="app">
      <h1>SMRT</h1>
      <ChatWindow />
      <p className="user-id">Session: {user?.id.slice(0, 8) ?? 'none'}</p>
    </div>
  );
}

export default App;