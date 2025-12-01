import { IsString, MinLength, MaxLength, Matches } from "class-validator";
import { ApiProperty } from '@nestjs/swagger'

export class SignUpDto{
    @ApiProperty({
        description: 'name of user',
        required: true,
      })
    @IsString()
    @MinLength(4)
    @MaxLength(20)
    username: string;

    @ApiProperty({
        description: 'password of user',
        required: true,
      })
    @IsString()
    @MinLength(8)
    @MaxLength(20)
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { message: 'password is too weak'})
    password: string;
}