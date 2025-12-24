import { UserRepository, User } from '../../ports/repositories/user.repository';
import { NotFoundError } from '../../../domain/errors/domain-error';

export class MeUseCase {
  private readonly userRepository: UserRepository;

  constructor({ userRepository }: { userRepository: UserRepository }) {
    this.userRepository = userRepository;
  }

  async execute(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return user;
  }
}
