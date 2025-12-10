
import { FastifyRequest, FastifyReply } from 'fastify';
import { createServerClient } from '@supabase/ssr';
import { AuthService, AuthUser } from '../../application/ports/services/auth.service';
import { AuthenticationError } from '../../domain/errors/domain-error';
import { createClient } from './supabase'; // Existing helper

export class SupabaseAuthService implements AuthService {
  private readonly supabase;

  constructor(request: FastifyRequest, reply: FastifyReply) {
    // We create the client using the request and reply objects to handle cookies
    this.supabase = createClient(request, reply);
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new AuthenticationError('Invalid email or password');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new AuthenticationError('Email not confirmed');
      }
      // For other errors, we might want to throw a generic auth error or a business logic error
      // Ideally we shouldn't leak technical details if not necessary, but for debugging logging is key.
      // Here we throw AuthError.
      throw new AuthenticationError(error.message);
    }

    if (!data.user) {
      throw new AuthenticationError('Login failed: no user data returned');
    }

    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }

  async logout(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      // Log warning but don't fail operation typically?
      // For strict correctness, we can throw.
      console.error('Logout failed', error);
    }
  }
}
