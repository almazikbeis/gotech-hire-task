import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { Message } from '../../entities/message.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';

export interface MessageWithUser {
  id: number;
  content: string;
  roomId: number;
  userId: number;
  username: string;
  createdAt: Date;
}

export interface PaginatedMessages {
  messages: MessageWithUser[];
  nextCursor: number | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async getRooms(): Promise<Room[]> {
    return this.roomRepository.find({ order: { createdAt: 'ASC' } });
  }

  async createRoom(dto: CreateRoomDto): Promise<Room> {
    const existing = await this.roomRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      return existing;
    }
    const room = this.roomRepository.create(dto);
    return this.roomRepository.save(room);
  }

  async getMessages(roomId: number, dto: GetMessagesDto): Promise<PaginatedMessages> {
    await this.findRoomOrThrow(roomId);

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .innerJoinAndSelect('message.user', 'user')
      .where('message.roomId = :roomId', { roomId })
      .orderBy('message.id', 'DESC')
      .take(dto.limit);

    if (dto.cursor) {
      qb.andWhere('message.id < :cursor', { cursor: dto.cursor });
    }

    const rows = await qb.getMany();

    const messages: MessageWithUser[] = rows.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      roomId: m.roomId,
      userId: m.userId,
      username: m.user.username,
      createdAt: m.createdAt,
    }));

    const nextCursor = rows.length === dto.limit ? rows[rows.length - 1].id : null;

    return { messages, nextCursor };
  }

  async saveMessage(roomId: number, userId: number, content: string): Promise<MessageWithUser> {
    const message = this.messageRepository.create({ roomId, userId, content });
    const saved = await this.messageRepository.save(message);

    const withUser = await this.messageRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    if (!withUser) {
      throw new NotFoundException('Saved message not found');
    }

    return {
      id: withUser.id,
      content: withUser.content,
      roomId: withUser.roomId,
      userId: withUser.userId,
      username: withUser.user.username,
      createdAt: withUser.createdAt,
    };
  }

  private async findRoomOrThrow(id: number): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException(`Room ${id} not found`);
    }
    return room;
  }
}
