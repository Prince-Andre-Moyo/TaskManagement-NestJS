import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty({
    description: "The title's heading",
    required: true,
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({
    description: 'definition of the task',
    required: true,
    })
    @IsString()
    @IsNotEmpty()
    description: string;
}