import { IsEnum } from 'class-validator';
import { TaskStatus } from "../task-status.enum";
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskStatusDto{
    @ApiProperty({
        description: 'whether the task is still OPEN, CLOSED or IN_PROGRESS',
        required: true,
    })
    @IsEnum(TaskStatus)
    status: TaskStatus;
}