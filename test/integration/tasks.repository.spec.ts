import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../src/auth/user.entity";
import { CreateTaskDto } from "../../src/tasks/dto/create-task.dto";
import { GetTasksFilterDto } from "../../src/tasks/dto/get-tasks-filter.dto";
import { Task } from "../../src/tasks/task.entity";
import { TasksRepository } from "../../src/tasks/tasks.repository";
import { ObjectLiteral, Repository } from "typeorm";

//yarn test:integration:file test/integration/tasks.repository.spec.ts -i --runInBand

/**
 * Scope: Test multiple classes working together, usually including repositories and the real database.
 *Focus: Make sure entities, repositories, and DB interactions work as expected.
 *Dependencies: Real or test DB (often in-memory SQLite).
 *Example: TasksRepository.createTask() actually saves a task to the test DB, and you assert it exists after the call.
 */

jest.setTimeout(20000);

describe('TasksRepository (integration)', () => {
  let moduleRef: TestingModule | undefined;
  let typeOrmTaskRepo: Repository<Task>;
  let typeOrmUserRepo: Repository<User>;
  let tasksRepo: TasksRepository;

  beforeAll(async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            dropSchema: true,
            entities: [User, Task],
            synchronize: true,
            retryAttempts: 0,
            logging: false,
          }),
          TypeOrmModule.forFeature([Task, User]),
        ],
      }).compile();

      // get underlying TypeORM repositories
      typeOrmTaskRepo = moduleRef.get<Repository<Task>>(getRepositoryToken(Task));
      typeOrmUserRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));

      // create a minimal DatabaseService-like stub that TasksRepository expects
      const dbStub = {
        getRepository: <T extends ObjectLiteral>(entity: any): Repository<T> => {
          if (entity === Task) return typeOrmTaskRepo as unknown as Repository<T>;
          if (entity === User) return typeOrmUserRepo as unknown as Repository<T>;
          throw new Error('Unknown entity requested in test dbStub');
        },
      };

      // instantiate the repository under test with the real TypeORM repo via stub
      tasksRepo = new TasksRepository(dbStub as any);
    } catch (err) {
      console.error('Failed to setup integration test module:', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('createTask persists a task and getTasks / findByIdAndUser / deleteByIdAndUser work', async () => {
    // 1) create a user (acts as owner)
    const user = typeOrmUserRepo.create({
      username: 'integ_user',
      password: 'Password1!',
    });
    const savedUser = await typeOrmUserRepo.save(user);

    // 2) create a task via repository
    const createDto: CreateTaskDto = { title: 'integ task', description: 'integration test' };
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

    // 6) after delete, findByIdAndUser should be null
    const shouldBeNull = await tasksRepo.findByIdAndUser(created.id, savedUser);
    expect(shouldBeNull).toBeNull();
  });
});