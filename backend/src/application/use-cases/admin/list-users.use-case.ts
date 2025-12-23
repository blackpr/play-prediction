import { UserRepository, FindAllUsersParams, PaginatedUsers } from '../../ports/repositories/user.repository';

export class ListUsersUseCase {
  private readonly userRepository: UserRepository;

  constructor({ userRepository }: { userRepository: UserRepository }) {
    this.userRepository = userRepository;
  }

  async execute(params: FindAllUsersParams): Promise<PaginatedUsers> {
    // Set defaults
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100); // Cap at 100

    return this.userRepository.findAll({
      search: params.search,
      role: params.role,
      page,
      pageSize,
    });
  }
}
