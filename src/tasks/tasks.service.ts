import { Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TaskStatus } from './task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { GetTasksFilterDto } from './dto/get-tasks-filter.dto';
import { Task } from './task.entity';
import { User } from '../auth/user.entity';
import { TasksRepository } from './tasks.repository';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TasksService {

    constructor(
        private readonly tasksRepo: TasksRepository,
        private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(TasksService.name);
    }

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
            // pass through ServiceUnavailable so client sees 503
            if (error instanceof ServiceUnavailableException) throw error;

            this.logger.error(`Failed to get tasks for user "${user.username}". Filters: ${JSON.stringify(filterDto)}`, error.stack,);

            throw new InternalServerErrorException();
        }
    }

    async getTaskById(id: string, user: User): Promise<Task>{
        try{
            const found = await this.tasksRepo.findByIdAndUser(id, user);

            if(!found){
                throw new NotFoundException(`Task with ID "${id}" not found!`);
            }
            return found;
        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;

            // if the repo threw a NotFoundException we let it bubble (but repo currently returns null)
            this.logger.error(`Failed to fetch task ${id} for user "${user.username}"`, (error as any)?.stack);
            throw error instanceof NotFoundException ? error : new InternalServerErrorException();
        } 
    }

    async createTask(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
        try {
            return await this.tasksRepo.createTask(createTaskDto, user); 
        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;

            this.logger.error(`Failed to create task for user "${user.username}". Data: ${JSON.stringify(createTaskDto)}`, error.stack);
            throw new InternalServerErrorException();
        }
    }

    async deleteTask(id: string, user: User): Promise<void>{
        try {
            const affected = await this.tasksRepo.deleteByIdAndUser(id, user);
        
            if(affected === 0){
                throw new NotFoundException(`Task with ID "${id}" not found`); 
            }  
        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;

            this.logger.error(`Failed to delete task ${id} for user "${user.username}"`, (error as any)?.stack);
            throw error instanceof NotFoundException ? error : new InternalServerErrorException();
        }
        
    }

    async updateTaskStatus(id: string, status: TaskStatus, user: User): Promise<Task>{
        try {
            const task = await this.getTaskById(id, user);
            task.status = status;
            await this.tasksRepo.save(task);

            this.logger.info(`User "${user.username}" updated task ${id} status to ${status}`);
            return task;
        } catch (error) {
            if (error instanceof ServiceUnavailableException) throw error;

            this.logger.error(`Failed to update status for task ${id} by user "${user.username}"`, (error as any)?.stack);
            throw error instanceof NotFoundException ? error : new InternalServerErrorException();
        }
        
    }
}
