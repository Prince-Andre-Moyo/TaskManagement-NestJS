import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from './task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { Task } from './task.entity';
import { User } from '../auth/user.entity';
import { Logger } from '@nestjs/common';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
    private logger = new Logger('TasksService', { timestamp: true });

    constructor(private readonly tasksRepo: TasksRepository) {}

    /*
    Request page 1 with default limit: GET /tasks
    Request page 2 with limit 10: GET /tasks?page=2&limit=10
    With filters: GET /tasks?status=OPEN&search=report&page=1&limit=25
    */
    async getTasks(filterDto: GetTasksFilterDto, user: User): Promise<{ data: Task[]; total: number; page: number; limit: number }>{
        const page = filterDto.page ?? 1;
        const limit = Math.min(filterDto.limit ?? 20, 100);

        try {
            const [tasks, total] = await this.tasksRepo.getTasks(filterDto, user, page, limit);
            return { data: tasks, total, page, limit };
        } catch (error) {
            this.logger.error(`Failed to get tasks for user "${user.username}". Filters: ${JSON.stringify(filterDto)}`, error.stack,);
            throw new InternalServerErrorException();
        }
    }

    async getTaskById(id: string, user: User): Promise<Task>{
        const found = await this.tasksRepo.findByIdAndUser(id, user);

        if(!found){
             throw new NotFoundException(`Task with ID "${id}" not found!`);
         }
         return found;
    }

    async createTask(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
        try {
            return await this.tasksRepo.createTask(createTaskDto, user); 
        } catch (error) {
            this.logger.error(`Failed to create task for user "${user.username}". Data: ${JSON.stringify(createTaskDto)}`, error.stack);
            throw new InternalServerErrorException();
        }
    }

    async deleteTask(id: string, user: User): Promise<void>{
        const affected = await this.tasksRepo.deleteByIdAndUser(id, user);
        
        if(affected === 0){
           throw new NotFoundException(`Task with ID "${id}" not found`); 
        }
    }

    async updateTaskStatus(id: string, status: TaskStatus, user: User): Promise<Task>{
        const task = await this.getTaskById(id, user);
        task.status = status;
        await this.tasksRepo.save(task);

        this.logger.verbose(`User "${user.username}" updated task ${id} status to ${status}`);
        return task;
    }
}
