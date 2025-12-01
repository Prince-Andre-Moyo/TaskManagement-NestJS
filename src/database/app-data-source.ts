import { User } from "src/auth/user.entity";
import { Task } from "src/tasks/task.entity";
import { DataSource } from "typeorm";


export function createAppDataSource(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
}) {
    return new DataSource({
        type: 'postgres',
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],  // Dynamic entity loading
        synchronize: config.synchronize,
    });
}