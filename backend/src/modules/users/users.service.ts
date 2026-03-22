import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export interface PublicUser {
  id: number;
  username: string;
  role: string;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: number): Promise<PublicUser | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;
    return this.toPublicUser(user);
  }

  private toPublicUser(user: User): PublicUser {
    const { password: _password, messages: _messages, ...publicFields } = user;
    return publicFields as PublicUser;
  }
}
