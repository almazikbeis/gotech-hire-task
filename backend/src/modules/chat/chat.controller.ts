import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  getRooms() {
    return this.chatService.getRooms();
  }

  @Post('rooms')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(dto);
  }

  @Get('rooms/:roomId/messages')
  getMessages(
    @Param('roomId', ParseIntPipe) roomId: number,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatService.getMessages(roomId, query);
  }
}
