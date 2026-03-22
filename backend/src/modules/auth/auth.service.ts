import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { BCRYPT_SALT_ROUNDS, JWT_EXPIRES_IN } from '../../common/constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.userRepository.create({ username: dto.username, password: hashedPassword });
    const saved = await this.userRepository.save(user);

    return this.buildTokenResponse(saved);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findOne({ where: { username: dto.username } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildTokenResponse(user);
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.config.getOrThrow<string>('JWT_SECRET')) as JwtPayload;
    } catch {
      return null;
    }
  }

  private buildTokenResponse(user: User): AuthResponse {
    const payload: JwtPayload = { userId: user.id, username: user.username };
    const token = jwt.sign(payload, this.config.getOrThrow<string>('JWT_SECRET'), {
      expiresIn: JWT_EXPIRES_IN,
    });
    return { token, userId: user.id };
  }
}
