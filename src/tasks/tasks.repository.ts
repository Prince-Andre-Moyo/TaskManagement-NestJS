import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Task } from "./task.entity";
import { GetTasksFilterDto } from "./dto/get-tasks-filter.dto";
import { User } from "../auth/user.entity";
import { CreateTaskDto } from "./dto/create-task.dto";
import { DB_ERROR_CODES } from "../shared/db-errors";
import { TaskStatus } from "./task-status.enum";

@Injectable()
export class TasksRepository {
    constructor(
        @InjectRepository(Task)
        private readonly repo: Repository<Task>,
    ){}

    async getTasks(filterDto: GetTasksFilterDto, user: User, page: number, limit: number,): Promise<[Task[], number]> {
        const { status, search } = filterDto;
        const skip = (page - 1) * limit;

        const query = this.repo.createQueryBuilder('task');
        query.where('task.userId = :userId', { userId: user.id });

        if (status) {
            query.andWhere('task.status = :status', { status });
        }

        if (search) {
            query.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {search: `%${search}%`, });
        }

        query.take(limit);
        query.skip(skip);

        try {
            return await query.getManyAndCount();
        } catch (error) {
            throw new InternalServerErrorException();
        }
    }

    async findByIdAndUser(id: string, user: User): Promise<Task | null> {
        return this.repo.findOne({ where: { id, user: { id: user.id} } });
    }

    async createTask(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
        const { title, description } = createTaskDto;
        const task = this.repo.create({
            title,
            description,
            status: TaskStatus.OPEN,
            user,
        });
        try {
            return await this.repo.save(task);
        } catch (error) {
            if (error?.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
                throw new InternalServerErrorException('Duplicate task');
            }
            throw new InternalServerErrorException();
        }
    }

    async deleteByIdAndUser(id: string, user: User): Promise<number> {
        const result = await this.repo.delete({ id, user });
        return result.affected ?? 0;
    }

    async save(task: Task): Promise<Task> {
        return this.repo.save(task);
    }
}