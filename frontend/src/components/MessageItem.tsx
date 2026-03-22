import React from 'react';
import { Message } from '../types';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
}

export default function MessageItem({ message, isOwn }: MessageItemProps) {
  const formatTime = (dateStr: string): string =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
      }}
    >
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
        {message.username} · {formatTime(message.createdAt)}
      </div>
      <div
        style={{
          maxWidth: '70%',
          padding: '8px 12px',
          borderRadius: '12px',
          backgroundColor: isOwn ? '#0084ff' : '#e4e6ea',
          color: isOwn ? 'white' : 'black',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
