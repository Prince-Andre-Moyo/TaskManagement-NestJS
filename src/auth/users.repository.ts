import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./user.entity";
import { Repository } from "typeorm";
import { SignUpDto } from "./dto/sign-up.dto";
import { DB_ERROR_CODES } from "../shared/db-errors";

@Injectable()
export class UsersRepository {
    constructor(
        @InjectRepository(User)
        private repo: Repository<User>,
    ) {}

    async createUser(signUpDto: SignUpDto & { hashedPassword: string }): Promise<User> {
        const { username, hashedPassword } = signUpDto as any;
        const user = this.repo.create({ username, password: hashedPassword});

        try {
            return await this.repo.save(user);
        } catch (error) {
            if (error?.code === DB_ERROR_CODES.UNIQUE_VIOLATION) {
                throw new ConflictException('Username already exists');
            }
            throw new InternalServerErrorException();
        }
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.repo.findOne({ where: { username } });
    }

    // Add more methods: updatePassword, findById, etc.
}
