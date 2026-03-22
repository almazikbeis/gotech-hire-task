import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';
import { ROOM_PREFIX } from '../../common/constants';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

interface SendMessagePayload {
  roomId: number;
  content: string;
}

interface RoomPayload {
  roomId: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  handleConnection(client: Socket): void {
    const payload = this.extractUser(client);
    if (!payload) {
      client.disconnect();
      return;
    }
    client.data.user = payload;
  }

  handleDisconnect(_client: Socket): void {
    // socket.io cleans up rooms automatically on disconnect
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: RoomPayload, @ConnectedSocket() client: Socket): void {
    client.join(`${ROOM_PREFIX}${data.roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@MessageBody() data: RoomPayload, @ConnectedSocket() client: Socket): void {
    client.leave(`${ROOM_PREFIX}${data.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) {
      throw new WsException('Unauthorized');
    }

    if (!data.content?.trim()) {
      throw new WsException('Message content cannot be empty');
    }

    const message = await this.chatService.saveMessage(
      data.roomId,
      user.userId,
      data.content.trim(),
    );

    this.server.to(`${ROOM_PREFIX}${data.roomId}`).emit('newMessage', message);
  }

  private extractUser(client: Socket): JwtPayload | null {
    const raw: string | undefined =
      client.handshake.auth?.token ?? client.handshake.headers?.authorization;
    if (!raw) return null;
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    return this.authService.verifyToken(token);
  }
}
