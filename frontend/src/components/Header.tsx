import React from 'react';

interface HeaderProps {
  username: string;
  isConnected: boolean;
  onLogout: () => void;
}

export default function Header({ username, isConnected, onLogout }: HeaderProps) {
  return (
    <div style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #ddd' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{username || 'Loading...'}</div>
      <div
        style={{
          fontSize: '12px',
          color: isConnected ? 'green' : 'gray',
          marginBottom: '8px',
        }}
      >
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <button
        onClick={onLogout}
        style={{ fontSize: '12px', padding: '4px 8px', cursor: 'pointer', width: '100%' }}
      >
        Logout
      </button>
    </div>
  );
}
