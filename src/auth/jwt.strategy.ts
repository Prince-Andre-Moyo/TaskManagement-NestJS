//a strategy is just an injectable class
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { JwtPayload } from "./jwt-payload.interface";
import { User } from "./user.entity";
import { ConfigService } from "@nestjs/config";
import { UsersRepository } from './users.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: UsersRepository,
        private readonly configService: ConfigService,
    ){
        super({
            secretOrKey: configService.get<string>('JWT_SECRET')!,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        });
    }

    async validate(payload: JwtPayload){
        const { username } = payload;
        const user = await this.usersRepo.findByUsername(username);

        if (!user){
            throw new UnauthorizedException();
        }

        // req.user will have id, username, but not password
        const { password, ...safeuser } = user as any;
        return safeuser;
    }
}