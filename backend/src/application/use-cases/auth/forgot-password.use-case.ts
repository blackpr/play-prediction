import { AuthService } from '../../ports/services/auth.service';

export class ForgotPasswordUseCase {
  private readonly authService: AuthService;

  constructor({ authService }: { authService: AuthService }) {
    this.authService = authService;
  }

  async execute(email: string): Promise<void> {
    await this.authService.resetPasswordForEmail(email);
  }
}
