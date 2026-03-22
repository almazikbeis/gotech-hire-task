import React from 'react';
import { Room } from '../types';

interface RoomListProps {
  rooms: Room[];
  selectedRoom: Room | null;
  onSelectRoom: (room: Room) => void;
}

export default function RoomList({ rooms, selectedRoom, onSelectRoom }: RoomListProps) {
  if (rooms.length === 0) {
    return <p style={{ color: '#999', fontSize: '14px' }}>No rooms yet. Create one!</p>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {rooms.map((room) => (
        <div
          key={room.id}
          onClick={() => onSelectRoom(room)}
          style={{
            padding: '8px',
            cursor: 'pointer',
            backgroundColor: selectedRoom?.id === room.id ? '#ddd' : 'transparent',
            borderRadius: '4px',
            marginBottom: '2px',
          }}
        >
          <div style={{ fontWeight: 'bold' }}>#{room.name}</div>
          {room.description && (
            <div
              style={{
                fontSize: '12px',
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {room.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
