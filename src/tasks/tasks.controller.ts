import { Controller, Get, Post, Body, Param, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { Task } from './task.entity';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../auth/user.entity';
import { Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';


@Controller('tasks')
@UseGuards(AuthGuard())
@ApiBearerAuth()
export class TasksController {
    private logger = new Logger('TasksController');
    constructor(private tasksService: TasksService) { }

    @Get()
    @ApiOperation({ summary: "Fetch a list of tasks"})
    @ApiOkResponse({ description: "List of tasks fetched successfully." })
    @ApiResponse({
        status: 500,
        description: "Internal server error.",
    })
    getTasks(
        @Query() filterDto: GetTasksFilterDto,
        @GetUser() user: User,
    ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
        this.logger.verbose(`User "${user.username}" retrieving all tasks. Filters: ${JSON.stringify(filterDto,)}`,);
        return this.tasksService.getTasks(filterDto, user);
    }

    @Get('/:id')
    @ApiOperation({ summary: "Fetch a task by id"})
    @ApiOkResponse({ description: "task fetched successfully." })
    @ApiNotFoundResponse({ description: "task not found." })
    getTaskById(@Param('id') id: string, @GetUser() user: User,): Promise<Task> {
        return this.tasksService.getTaskById(id, user);
    }

    @Post()
    @ApiOperation({ summary: "Create a new task"})
    @ApiCreatedResponse({ description: "task created successfully." })
    createTask(
        @Body() createTaskDto: CreateTaskDto,
        @GetUser() user: User,
    ): Promise<Task> {
        this.logger.verbose(`User "${user.username}" creating a new tasks. Data: ${JSON.stringify(createTaskDto)}`);
        return this.tasksService.createTask(createTaskDto, user);
    }

    @Delete('/:id')
    @ApiOperation({ summary: "Delete a task by id"})
    @ApiResponse({
        status: 200,
        description: "task deleted successfully.",
    })
    deleteTask(
        @Param('id') id: string,
        @GetUser() user: User, 
    ): Promise<void>{
        return this.tasksService.deleteTask(id, user);
    }

    @Patch('/:id/status')
    @ApiOperation({ summary: "Update a task's status"})
    @ApiResponse({
        status: 200,
        description: "Task's status updated successfully.",
    })
    updateTaskStatus(
        @Param('id') id: string, 
        @Body() updateTaskStatusDto: UpdateTaskStatusDto,
        @GetUser() user: User,
    ): Promise<Task>{
        const { status } = updateTaskStatusDto;
        return this.tasksService.updateTaskStatus(id, status, user);
    }
}