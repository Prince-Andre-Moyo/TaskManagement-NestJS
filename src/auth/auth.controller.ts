import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ){}

    @Post('/signup')
    @ApiOperation({ summary: "Register a new user"})
    @ApiResponse({
        status: 201,
        description: "signed up successfully.",
    })
    signUp(@Body() authCredentialsDto: SignUpDto): Promise<void>{
        return this.authService.signUp(authCredentialsDto);
    }

    @Post('/signin')
    @ApiOperation({ summary: "Login to get access token"})
    @ApiResponse({
        status: 201,
        description: "signed in successfully.",
    })
    signIn(@Body() authCredentialsDto: SignInDto): Promise<{ accessToken: string }>{
        return this.authService.signIn(authCredentialsDto);
    }
}

// If you ever return users, map them to a SafeUserDto (id + username, no password).