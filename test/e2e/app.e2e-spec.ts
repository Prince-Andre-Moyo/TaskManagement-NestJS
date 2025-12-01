// test/e2e/app.e2e-spec.ts
import { INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { getDataSourceToken, TypeOrmModule } from "@nestjs/typeorm";
import request from 'supertest';
import { AuthModule } from "../../src/auth/auth.module";
import { User } from "../../src/auth/user.entity";
import { Task } from "../../src/tasks/task.entity";
import { TasksModule } from "../../src/tasks/tasks.module";
import { DataSource, ObjectLiteral } from "typeorm";
import { DatabaseService } from "../../src/database/database.service"; 

jest.setTimeout(20000);

describe('Tasks e2e (auth + tasks)', () => {
  let app: INestApplication;
  const JWT_SECRET = 'testJwtSecret';
  const BCRYPT_SALT_ROUNDS = '4';
  const JWT_EXPIRES_IN = '3600';

  beforeAll(async () => {
    // envs needed by JwtModule/config validation
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.BCRYPT_SALT_ROUNDS = BCRYPT_SALT_ROUNDS;
    process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;
    process.env.STAGE = 'test';

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const builder = Test.createTestingModule({
        imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            dropSchema: true,
            entities: [User, Task],
            synchronize: true,
            retryAttempts: 0,
            logging: false,
        }),
        AuthModule,
        TasksModule,
        ],
        // no providers here — we'll override DatabaseService below
    });

    // override DatabaseService BEFORE compile. Use an async factory that ensures DataSource is initialized.
    builder.overrideProvider(DatabaseService).useFactory({
        // this async factory gets the DataSource (created by TypeOrmModule) injected,
        // awaits ds.initialize() to ensure it's ready, then returns an object that
        // exposes getRepository() which proxies to the real TypeORM DataSource.
        factory: async (ds: DataSource) => {
        // initialize DataSource if it's not already
        if (!ds.isInitialized) {
            await ds.initialize();
        }

        // return an object that matches your DatabaseService's API (only getRepository used in tests)
        return {
            getRepository: <T extends ObjectLiteral>(entity: any) => ds.getRepository<T>(entity),
            // if code calls getDataSource(), expose it too:
            getDataSource: () => ds,
            // you can add other helpers used in your app here
        } as unknown as DatabaseService;
        },
        inject: [getDataSourceToken()],
    });

    const moduleFixture: TestingModule = await builder.compile();

    // optional: confirm the DatabaseService that was registered is indeed ready
    const providedDb = moduleFixture.get<DatabaseService>(DatabaseService);
    // if you want, you can sanity-check here:
    // try { providedDb.getRepository(User); } catch (e) { console.error('db provider not ready', e); throw e; }

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    });


  afterAll(async () => {
    (Logger.prototype.error as jest.Mock).mockRestore();
    
    try {
      // destroy TypeORM DataSource if initialized
      const ds = app.get<DataSource>(getDataSourceToken());
      if (ds && ds.isInitialized) {
        await ds.destroy();
      }
    } catch (err) {
      // ignore
    }
    await app.close();
  });

  it('GET /tasks without token should return 401', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('full flow: signup -> signin -> create -> list -> update -> delete', async () => {
    const server = request(app.getHttpServer());

    // signup
    await server
      .post('/auth/signup')
      .send({ username: 'e2euser', password: 'Password1!' })
      .expect(201);

    // signin
    const signinRes = await server
      .post('/auth/signin')
      .send({ username: 'e2euser', password: 'Password1!' })
      .expect(201);
    const token = signinRes.body.accessToken;
    expect(token).toBeDefined();

    // create
    const taskDto = { title: 'e2e task', description: 'Integration test' };
    const createRes = await server
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(taskDto)
      .expect(201);
    const created = createRes.body;
    expect(created).toHaveProperty('id');
    expect(created.title).toBe(taskDto.title);
    const taskId = created.id;

    // list
    const listRes = await server.get('/tasks').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);

    // update
    await server
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' })
      .expect(200)
      .then(res => expect(res.body.status).toBe('DONE'));

    // delete
    await server.delete(`/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).expect(200);

    // confirm deletion
    await server.get(`/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).expect(404);
  }, 15000);
});
