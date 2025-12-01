// test/integration/users.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { UsersRepository } from '../../src/auth/users.repository';
import { User } from '../../src/auth/user.entity';
import { SignUpDto } from '../../src/auth/dto/sign-up.dto';
import { Task } from '../../src/tasks/task.entity';

// yarn test:integration:file test/integration/users.repository.spec.ts -i --runInBand

jest.setTimeout(20000);

describe('UsersRepository (integration)', () => {
  let moduleRef: TestingModule | undefined;
  let typeOrmUserRepo: Repository<User>;
  let usersRepo: UsersRepository;

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
          TypeOrmModule.forFeature([User, Task]),
        ],
      }).compile();

      // get the real TypeORM repository
      typeOrmUserRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));

      // create a minimal DatabaseService-like stub with getRepository()
      const dbStub = {
        getRepository: <T extends ObjectLiteral>(entity: any): Repository<T> => {
          if (entity === User) return typeOrmUserRepo as unknown as Repository<T>;
          throw new Error('Unknown entity requested in test dbStub');
        },
      };

      // instantiate UsersRepository with the dbStub (not with the raw TypeORM repo)
      usersRepo = new UsersRepository(dbStub as any);
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

  it('createUser persists a user and findByUsername works', async () => {
    const signUpDto = {
      username: 'integ_user',
      password: 'PlainPass1!',
      hashedPassword: 'hashed-12345',
    } as SignUpDto & { hashedPassword: string };

    const created = await usersRepo.createUser(signUpDto);

    expect(created).toHaveProperty('id');
    expect(created.username).toBe(signUpDto.username);
    expect(created.password).toBe(signUpDto.hashedPassword);

    const found = await usersRepo.findByUsername(signUpDto.username);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);

    const missing = await usersRepo.findByUsername('nonexistent');
    expect(missing).toBeNull();
  });
});
