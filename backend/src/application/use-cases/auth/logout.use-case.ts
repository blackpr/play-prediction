import { AuthService } from '../../ports/services/auth.service';

export class LogoutUseCase {
  private readonly authService: AuthService;

  constructor({ authService }: { authService: AuthService }) {
    this.authService = authService;
  }

  async execute() {
    await this.authService.logout();
    return { message: 'Successfully logged out' };
  }
}
