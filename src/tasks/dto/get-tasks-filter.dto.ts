import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from "class-validator";
import { TaskStatus } from "../task-status.enum";
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetTasksFilterDto {
    @ApiProperty({
    description: 'whether the task is still OPEN, CLOSED or IN_PROGRESS',
    required: false,
    })
    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;

    @ApiProperty({
    description: 'find the task by keyword',
    required: false,
    })
    @IsOptional()
    @IsString()
    search?: string;

    //pagination
    @ApiProperty({
    description: 'the page number of tasks',
    required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
    description: 'number of tasks in the page',
    required: false,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}