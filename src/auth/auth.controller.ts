import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ){}

    @Post('/signup')
    signUp(@Body() authCredentialsDto: SignUpDto): Promise<void>{
        return this.authService.signUp(authCredentialsDto);
    }

    @Post('/signin')
    signIn(@Body() authCredentialsDto: SignInDto): Promise<{ accessToken: string }>{
        return this.authService.signIn(authCredentialsDto);
    }
}
