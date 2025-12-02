import { HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt-payload.interface';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { UsersRepository } from './users.repository';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class AuthService {
    private readonly saltRounds: number;

    constructor(
        private usersRepo: UsersRepository,
        private jwtService: JwtService,
        private configService: ConfigService,
        private readonly logger: PinoLogger,
    ){
        this.saltRounds = Number(this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10);
        this.logger.setContext(AuthService.name);
    }

    async signUp(signUpDto: SignUpDto): Promise<void> {
        try {
            const salt = await bcrypt.genSalt(this.saltRounds);
            const hashedPassword = await bcrypt.hash(signUpDto.password, salt);

            await this.usersRepo.createUser({...signUpDto, hashedPassword});

            this.logger.info(`Successfully signed up a new user: "${signUpDto.username}"`);

        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;
            if (error instanceof HttpException) throw error;
            
            this.logger.error(`Failed to sign up a new user: "${signUpDto.username}"`, (error as any)?.stack);
            throw error instanceof NotFoundException ? error : new InternalServerErrorException();
        }
        
    }

    async signIn(signInDto: SignInDto): Promise<{ accessToken: string }>{
        try {
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
            
            this.logger.info(`User Successfully signedIn, user: "${signInDto.username}"`);

            return { accessToken };  
            
            
        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;
            if (error instanceof HttpException) throw error;
            
            this.logger.error(`Failed to signIn user: "${signInDto.username}"`, (error as any)?.stack);
            throw error instanceof NotFoundException ? error : new InternalServerErrorException();
        }
        
    }
}

