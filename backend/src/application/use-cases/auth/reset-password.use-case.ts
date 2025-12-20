import { AuthService } from '../../ports/services/auth.service';

export class ResetPasswordUseCase {
  private readonly authService: AuthService;

  constructor({ authService }: { authService: AuthService }) {
    this.authService = authService;
  }

  async execute(password: string): Promise<void> {
    await this.authService.updatePassword(password);
  }
}
