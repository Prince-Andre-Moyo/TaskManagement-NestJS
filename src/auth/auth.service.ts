import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConflictException, InternalServerErrorException } from "@nestjs/common";
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User) 
        private readonly usersRepository: Repository<User>,
        private jwtService: JwtService,
    ){}

    async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
        const { username, password } = authCredentialsDto;

        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = this.usersRepository.create({ username, password: hashedPassword });

        try {
            await this.usersRepository.save(user); 
        } catch (error) {

            //go to postgress documentation to confirm that whenever there is a duplicate the error code is 23505
            //console.log(error.code);

            if (error.code === '23505'){  //in prod, probably a good practice is to define an enum inside this class that has all the error codes i.e duplicate: 23505
                throw new ConflictException('Username already exists');
            }
            else{
                throw new InternalServerErrorException();
            }
        }
    }

    async signUp(authCredentialsDto: AuthCredentialsDto): Promise<void>{
        return this.createUser(authCredentialsDto);
    }

    async signIn(authCredentialsDto: AuthCredentialsDto): Promise<{ accessToken: string }>{
        const { username, password } = authCredentialsDto;
        const user = await this.usersRepository.findOne({ where:{username: username} });

        if (user && (await bcrypt.compare(password, user.password))){
            const payload: JwtPayload = { username };
            const accessToken: string = await this.jwtService.sign(payload);
            return { accessToken };
        }
        else{
            throw new UnauthorizedException('Please check your login credentials');
        }
    }

}

