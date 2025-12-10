import { FastifyRequest, FastifyReply } from 'fastify';
import { createServerClient } from '@supabase/ssr';
import { AuthService, AuthUser } from '../../application/ports/services/auth.service';
import { AuthenticationError } from '../../domain/errors/domain-error';
import { requireEnv } from '../../shared/config/env';
import { createClient } from './supabase'; // Existing helper

export class SupabaseAuthService implements AuthService {
  private readonly supabase;

  constructor(request: FastifyRequest, reply: FastifyReply) {
    // We create the client using the request and reply objects to handle cookies
    this.supabase = createClient(request, reply);
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'user' }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new AuthenticationError('Email is already registered', 'EMAIL_ALREADY_EXISTS');
      }
      throw new AuthenticationError(error.message, 'SIGNUP_FAILED');
    }

    if (!data.user) {
      throw new AuthenticationError('Signup failed: no user data returned', 'SIGNUP_FAILED');
    }

    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }

  async checkHealth(): Promise<boolean> {
    try {
      const supabaseUrl = requireEnv('SUPABASE_URL');
      const authHealthUrl = `${supabaseUrl}/auth/v1/health`;
      const response = await fetch(authHealthUrl);
      return response.ok;
    } catch (error) {
      return false;
    }
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
