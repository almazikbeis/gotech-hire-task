import React, { useState } from 'react';
import { API_BASE_URL } from '../constants/api';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data: { token?: string; userId?: number; message?: string } = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Registration failed');
        return;
      }
      login(data.token!, data.userId!);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}
      >
        <h2>Register</h2>
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <input
          placeholder="Username (3–20 chars)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: '8px', fontSize: '16px' }}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px', fontSize: '16px' }}
          required
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px', fontSize: '16px', cursor: 'pointer' }}
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>
        <a href="/login">Already have an account? Login</a>
      </form>
    </div>
  );
}
