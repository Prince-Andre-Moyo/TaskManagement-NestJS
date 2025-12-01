// test/unit/auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { UsersRepository } from '../../src/auth/users.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from '../../src/auth/dto/sign-up.dto';
import { SignInDto } from '../../src/auth/dto/sign-in.dto';
import {
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';


jest.mock('bcrypt', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockUsersRepository = () => ({
  createUser: jest.fn(),
  findByUsername: jest.fn(),
});

const mockJwtService = () => ({
  signAsync: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

describe('AuthService (unit)', () => {
  let authService: AuthService;
  let usersRepository: ReturnType<typeof mockUsersRepository>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let configService: ReturnType<typeof mockConfigService>;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    (Logger.prototype.error as jest.Mock).mockRestore();
    (Logger.prototype.log as jest.Mock).mockRestore();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useFactory: mockUsersRepository },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    authService = module.get(AuthService);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
    configService.get.mockReturnValue('10');
  });

  describe('signUp', () => {
    it('calls createUser with hashed password and resolves', async () => {
      const dto: SignUpDto = { username: 'bob', password: 'UserPass011' };

      (bcrypt.genSalt as jest.Mock).mockResolvedValue('somesalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword123');

      usersRepository.createUser.mockResolvedValue(undefined);

      await expect(authService.signUp(dto)).resolves.toBeUndefined();

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 'somesalt');
      expect(usersRepository.createUser).toHaveBeenCalledWith({
        username: dto.username,
        password: dto.password,
        hashedPassword: 'hashedPassword123',
      });
    });

    it('throws InternalServerErrorException when repository throws generic error', async () => {
      const dto: SignUpDto = { username: 'alice', password: 'Pwd12345' };

      (bcrypt.genSalt as jest.Mock).mockResolvedValue('somesalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      usersRepository.createUser.mockRejectedValue(new Error('db boom'));

      await expect(authService.signUp(dto)).rejects.toThrow(InternalServerErrorException);
    });

    it('rethrows ServiceUnavailableException from repository', async () => {
      const dto: SignUpDto = { username: 'alice', password: 'Pwd12345' };

      (bcrypt.genSalt as jest.Mock).mockResolvedValue('somesalt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      usersRepository.createUser.mockRejectedValue(new ServiceUnavailableException('db down'));

      await expect(authService.signUp(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('signIn', () => {
    it('returns accessToken on successful signin', async () => {
      const dto: SignInDto = { username: 'bob', password: 'UserPass011' };
      const storedUser = { id: 'u1', username: 'bob', password: 'hashed-from-db' };

      usersRepository.findByUsername.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('token-abc-123');

      const res = await authService.signIn(dto);
      expect(usersRepository.findByUsername).toHaveBeenCalledWith(dto.username);
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, storedUser.password);
      expect(jwtService.signAsync).toHaveBeenCalledWith({ username: dto.username });
      expect(res).toEqual({ accessToken: 'token-abc-123' });
    });

    it('throws UnauthorizedException when user not found', async () => {
      const dto: SignInDto = { username: 'missing', password: 'x' };
      usersRepository.findByUsername.mockResolvedValue(undefined);

      await expect(authService.signIn(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const dto: SignInDto = { username: 'bob', password: 'wrong' };
      const storedUser = { id: 'u1', username: 'bob', password: 'hash' };

      usersRepository.findByUsername.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.signIn(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rethrows ServiceUnavailableException from repository', async () => {
      const dto: SignInDto = { username: 'bob', password: 'pwd' };
      usersRepository.findByUsername.mockRejectedValue(new ServiceUnavailableException('db down'));

      await expect(authService.signIn(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws InternalServerErrorException when jwt.signAsync throws generic error', async () => {
      const dto: SignInDto = { username: 'bob', password: 'pwd' };
      const storedUser = { id: 'u1', username: 'bob', password: 'hash' };

      usersRepository.findByUsername.mockResolvedValue(storedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockRejectedValue(new Error('jwt boom'));

      await expect(authService.signIn(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
