import { ConflictException, Injectable, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";
import { User } from "./user.entity";
import { Repository } from "typeorm";
import { SignUpDto } from "./dto/sign-up.dto";
import { DB_ERROR_CODES } from "../shared/db-errors";
import { DatabaseService } from "../../src/database/database.service";

@Injectable()
export class UsersRepository {
    constructor(private readonly db: DatabaseService) {}

    // helper to get repo or throw service-unavailable if DB isn't ready
    private getRepo(): Repository<User> {
        try {
            return this.db.getRepository<User>(User);
        } catch (error) {
            throw new ServiceUnavailableException('Database not initialized');
        }
    }

    async createUser(signUpDto: SignUpDto & { hashedPassword: string }): Promise<User> {
        const { username, hashedPassword } = signUpDto as any;
        const repo = this.getRepo();
        const user = repo.create({ username, password: hashedPassword});

        try {
            return await repo.save(user);
        } catch (error) {
            if (error?.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
                throw new ConflictException('Username already exists');
            }
            throw new InternalServerErrorException();
        }
    }

    async findByUsername(username: string): Promise<User | null> {
        const repo = this.getRepo();
        return repo.findOne({ where: { username } });
    }

    // Add more methods: updatePassword, findById, etc.
}
