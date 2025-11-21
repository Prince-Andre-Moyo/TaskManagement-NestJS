import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt-payload.interface';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { UsersRepository } from './users.repository';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
    private readonly saltRounds: number;

    constructor(
        private usersRepo: UsersRepository,
        private jwtService: JwtService,
        private configService: ConfigService,
    ){
        this.saltRounds = Number(this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10);
    }

    async signUp(signUpDto: SignUpDto): Promise<void> {
        const salt = await bcrypt.genSalt(this.saltRounds);
        const hashedPassword = await bcrypt.hash(signUpDto.password, salt);
        await this.usersRepo.createUser({...signUpDto, hashedPassword});
    }

    async signIn(signInDto: SignInDto): Promise<{ accessToken: string }>{
        const { username, password } = signInDto;
        const user = await this.usersRepo.findByUsername(username);

        if (!user) {
            throw new UnauthorizedException('Please check your login credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('Please check your login credentials');
        }

        const payload: JwtPayload = { username };
        const accessToken = await this.jwtService.signAsync(payload);
        return { accessToken };
    }
}

