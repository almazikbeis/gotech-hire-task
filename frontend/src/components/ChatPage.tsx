import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../constants/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Room, Message } from '../types';
import Header from './Header';
import RoomList from './RoomList';
import MessageItem from './MessageItem';

export default function ChatPage() {
  const { auth, logout } = useAuth();
  const socket = useSocket();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ref tracks current room without causing stale closures in socket callbacks
  const selectedRoomRef = useRef<Room | null>(null);
  selectedRoomRef.current = selectedRoom;

  const authHeaders = {
    Authorization: `Bearer ${auth!.token}`,
    'Content-Type': 'application/json',
  };

  // Decode username directly from JWT payload — avoids a separate network request
  useEffect(() => {
    if (!auth?.token) return;
    try {
      const payload = JSON.parse(atob(auth.token.split('.')[1])) as { username?: string };
      setUsername(payload.username ?? '');
    } catch {
      setUsername('');
    }
  }, [auth]);

  // Fetch rooms once on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Register socket event handlers; clean up on socket change or unmount
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Append new message instead of re-fetching the entire list
    const onNewMessage = (message: Message) => {
      if (selectedRoomRef.current?.id === message.roomId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('newMessage', onNewMessage);
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('newMessage', onNewMessage);
    };
  }, [socket]);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/rooms`, { headers: authHeaders });
      if (res.ok) setRooms(await res.json());
    } catch {
      // silently ignore; user can retry via UI
    }
  };

  const fetchMessages = useCallback(
    async (roomId: number) => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
          headers: authHeaders,
        });
        if (res.ok) {
          const data: { messages: Message[] } = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth],
  );

  const handleRoomSelect = (room: Room) => {
    if (selectedRoom) {
      socket?.emit('leaveRoom', { roomId: selectedRoom.id });
    }
    setSelectedRoom(room);
    socket?.emit('joinRoom', { roomId: room.id });
    fetchMessages(room.id);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedRoom || !socket) return;
    socket.emit('sendMessage', { roomId: selectedRoom.id, content: newMessage.trim() });
    setNewMessage('');
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/chat/rooms`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewRoomName('');
        setNewRoomDesc('');
        setShowCreateRoom(false);
        await fetchRooms();
      }
    } catch {
      // silently ignore
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '250px',
          borderRight: '1px solid #ddd',
          display: 'flex',
          flexDirection: 'column',
          padding: '10px',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Header username={username} isConnected={isConnected} onLogout={logout} />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <h3 style={{ margin: 0 }}>Rooms</h3>
          <button
            onClick={() => setShowCreateRoom((v) => !v)}
            style={{ fontSize: '20px', cursor: 'pointer', border: 'none', background: 'none' }}
            aria-label="Create room"
          >
            +
          </button>
        </div>

        {showCreateRoom && (
          <div
            style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}
          >
            <input
              placeholder="Room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              style={{ padding: '5px' }}
            />
            <input
              placeholder="Description (optional)"
              value={newRoomDesc}
              onChange={(e) => setNewRoomDesc(e.target.value)}
              style={{ padding: '5px' }}
            />
            <button onClick={handleCreateRoom} style={{ padding: '5px', cursor: 'pointer' }}>
              Create
            </button>
          </div>
        )}

        <RoomList rooms={rooms} selectedRoom={selectedRoom} onSelectRoom={handleRoomSelect} />
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedRoom ? (
          <>
            <div
              style={{
                padding: '10px',
                borderBottom: '1px solid #ddd',
                backgroundColor: '#f9f9f9',
              }}
            >
              <h3 style={{ margin: 0 }}>#{selectedRoom.name}</h3>
              {selectedRoom.description && (
                <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
                  {selectedRoom.description}
                </p>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {loadingMessages ? (
                <p>Loading messages...</p>
              ) : (
                messages.map((msg) => (
                  <MessageItem key={msg.id} message={msg} isOwn={msg.userId === auth!.userId} />
                ))
              )}
            </div>

            <div
              style={{
                display: 'flex',
                padding: '10px',
                borderTop: '1px solid #ddd',
                gap: '10px',
              }}
            >
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: '8px', fontSize: '16px' }}
              />
              <button
                onClick={handleSendMessage}
                style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}
          >
            <p style={{ color: '#666' }}>Select a room to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
