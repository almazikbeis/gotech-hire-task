export interface Room {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Message {
  id: number;
  content: string;
  roomId: number;
  userId: number;
  username: string;
  createdAt: string;
}

export interface AuthUser {
  token: string;
  userId: number;
}
