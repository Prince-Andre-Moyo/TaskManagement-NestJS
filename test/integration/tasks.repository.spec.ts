import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../src/auth/user.entity";
import { CreateTaskDto } from "../../src/tasks/dto/create-task.dto";
import { GetTasksFilterDto } from "../../src/tasks/dto/get-tasks-filter.dto";
import { Task } from "../../src/tasks/task.entity";
import { TasksRepository } from "../../src/tasks/tasks.repository";
import { Repository } from "typeorm";

//yarn test:integration:file test/integration/tasks.repository.spec.ts -i --runInBand

/**
 * Scope: Test multiple classes working together, usually including repositories and the real database.
 *Focus: Make sure entities, repositories, and DB interactions work as expected.
 *Dependencies: Real or test DB (often in-memory SQLite).
 *Example: TasksRepository.createTask() actually saves a task to the test DB, and you assert it exists after the call.
 */

jest.setTimeout(10000); //allow a bit more time for DB ops

describe('TasksRepository (integration)', () => {
    let module: TestingModule;
    let tasksRepo: TasksRepository;
    let userRepo: Repository<User>;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    dropSchema: true,
                    entities: [User, Task],
                    synchronize: true,
                }),
                TypeOrmModule.forFeature([Task, User]),
            ],
            providers: [TasksRepository],
        }).compile();

        tasksRepo = module.get<TasksRepository>(TasksRepository);
        userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    });

    afterAll(async () => {
        await module.close();
    });

    it('createTask persists a task and getTasks / findByIdAndUser / deleteByIdAndUser work', async () => {

        // 1) create a user (acts as owner)
        const user = userRepo.create({
            username: 'integ_user',
            password: 'Password1!',
        });
        const savedUser = await userRepo.save(user);

        // 2) create a task via repository
        const createDto: CreateTaskDto = { title: 'integ task', description: 'integration test'};
        const created = await tasksRepo.createTask(createDto, savedUser);

        expect(created).toHaveProperty('id');
        expect(created.title).toBe(createDto.title);
        expect(created.user).toBeDefined();
        expect(created.user.id).toBe(savedUser.id);

        // 3) getTasks should return the created task when filtering by user
        const filter: GetTasksFilterDto = {};
        const [tasks, total] = await tasksRepo.getTasks(filter, savedUser, 1, 10);
        expect(total).toBeGreaterThanOrEqual(1);
        expect(tasks.some(t => t.id === created.id)).toBeTruthy();

        // 4) findByIdAndUser should find the task
        const found = await tasksRepo.findByIdAndUser(created.id, savedUser);
        expect(found).toBeDefined();
        expect(found!.id).toBe(created.id);

        // 5) deleteByIdAndUser should delete and return affected count
        const affected = await tasksRepo.deleteByIdAndUser(created.id, savedUser);
        expect(affected).toBeGreaterThanOrEqual(1);

        // 6) after delete,findByIdAndUser should be undefined
        const shouldBeUndefined = await tasksRepo.findByIdAndUser(created.id, savedUser);
        expect(shouldBeUndefined).toBeNull();
    });
});