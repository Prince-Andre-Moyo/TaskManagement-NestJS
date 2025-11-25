import { Test } from '@nestjs/testing';
import { User } from '../../src/auth/user.entity';
import { GetTasksFilterDto } from '../../src/tasks/dto/get-tasks-filter.dto';
import { TaskStatus } from '../../src/tasks/task-status.enum';
import { Task } from '../../src/tasks/task.entity';
import { TasksRepository } from '../../src/tasks/tasks.repository';
import { TasksService } from '../../src/tasks/tasks.service';
import { InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';


/** What we test (coverage)
 * getTasks() - returns the paginated envelope, and throws "InternalServerErrorException"
   if the repo fails.
 * getTasksById() - returns the task when found; throws "NotFoundException" when not found.
 * createTask() - returns created task; throws "InternalServerErrorException" if repo throws.
 * deleteTask() - resolves when affected > 0; throws "NotFoundException" when affected === 0.
 * updateTaskStatus() - updates status and returns saved task; throws "NotFoundException" if task missing. 
*/

 //{yarn jest test/unit/tasks.service.spec.ts -i --runInBand} to run in isolation

const mockTasksRepository = () => ({
    getTasks: jest.fn(),
    findByIdAndUser: jest.fn(),
    createTask: jest.fn(),
    deleteByIdAndUser: jest.fn(),
    save: jest.fn(),
});

describe('TasksService (unit)', () => {
    let tasksService: TasksService;
    let tasksRepository: ReturnType<typeof mockTasksRepository>;

    beforeAll(() => {
        //Suppress or mock the logger in tests to keep output clean
        //If other log levels are noisy, mock them too (log, warn, verbose, etc.)

        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});  
    });

    afterAll(() => {
        //Restore the spy after the tests — good hygiene so other test files aren’t affected if tests are run in the same process

        (Logger.prototype.error as jest.Mock).mockRestore();
    });

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                TasksService,
                { provide: TasksRepository, useFactory: mockTasksRepository },
            ],
        }).compile();

        tasksService = module.get(TasksService);
        tasksRepository = module.get(TasksRepository);
        jest.clearAllMocks();
    });

    const mockUser = { id: 'u1', username: 'bob', password: 'UserPass011' } as User;

    describe('getTasks', () => {
        it('calls TasksRepository.getTasks and returns the paginated envelope', async () => {
            const filter: GetTasksFilterDto = { page: 1, limit: 10};
            const tasksArray: Task[] = [
                {id: 't1', title: 'A', description: 'B', status: TaskStatus.OPEN, user: mockUser} as Task,
            ];

            tasksRepository.getTasks.mockResolvedValue([tasksArray, 1]);

            const result = await tasksService.getTasks(filter, mockUser);

            expect(tasksRepository.getTasks).toHaveBeenCalledWith(filter, mockUser, 1, 10);
            expect(result).toEqual({ data: tasksArray, total: 1, page: 1, limit: 10});
        });

        it('throws InternalServerErrorException when repository throws', async () => {
            const filter: GetTasksFilterDto = {}
            tasksRepository.getTasks.mockRejectedValue(new InternalServerErrorException());

            await expect(tasksService.getTasks(filter as any, mockUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('getTaskById', () => {
        it('returns the task when found', async () =>{
            const expected: Task = {id: 't1', title: 'A', description: 'B', status: TaskStatus.OPEN, user: mockUser} as Task;
            tasksRepository.findByIdAndUser.mockResolvedValue(expected);

            const result = await tasksService.getTaskById('t1', mockUser);
            expect(tasksRepository.findByIdAndUser).toHaveBeenCalledWith('t1', mockUser);
            expect(result).toBe(expected);
        });

        it('throws NotFoundException when task not found', async () => {
            tasksRepository.findByIdAndUser.mockResolvedValue(undefined);

            await expect(tasksService.getTaskById('nope', mockUser)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('createTask', () => {
        it('creates and returns a task', async () => {
            const dto = { title: 't', description: 'd' };
            const created: Task = { id: 't1', ...dto, status: TaskStatus.OPEN, user: mockUser} as Task;
            tasksRepository.createTask.mockResolvedValue(created);

            const result = await tasksService.createTask(dto as any, mockUser);
            expect(tasksRepository.createTask).toHaveBeenCalledWith(dto, mockUser);
            expect(result).toBe(created);
        });

        it('throws InternalServerErrorException when repository throws', async () => {
            const dto = { title: 't', description: 'd' };
            tasksRepository.createTask.mockRejectedValue(new Error('boom'));

            await expect(tasksService.createTask(dto as any, mockUser)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('deleteTask', () => {
        it('resolves when delete affected > 0', async () => {
            tasksRepository.deleteByIdAndUser.mockResolvedValue(1);

            await expect(tasksService.deleteTask('t1', mockUser)).resolves.toBeUndefined();
            expect(tasksRepository.deleteByIdAndUser).toHaveBeenCalledWith('t1', mockUser);
        });

        it('throws NotFoundException when no row deleted', async () => {
            tasksRepository.deleteByIdAndUser.mockResolvedValue(0);

            await expect(tasksService.deleteTask('tx', mockUser)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('UpdateTaskStatus', () => {
        it('updates status, saves and returns the task', async () => {
            const stored: Task = { id: 't1', title: 'A', description: 'B', status: TaskStatus.OPEN, user: mockUser } as Task;
            tasksRepository.findByIdAndUser.mockResolvedValue(stored);
            tasksRepository.save.mockImplementation(async (task: Task) => task);

            const result = await tasksService.updateTaskStatus('t1', TaskStatus.DONE, mockUser);

            expect(tasksRepository.findByIdAndUser).toHaveBeenCalledWith('t1', mockUser);
            expect(tasksRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: TaskStatus.DONE }));
            expect(result.status).toBe(TaskStatus.DONE);
        });

        it('throws NotFoundException when task not found', async () => {
            tasksRepository.findByIdAndUser.mockResolvedValue(undefined);

            await expect(tasksService.updateTaskStatus('tx', TaskStatus.IN_PROGRESS, mockUser)).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});