import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, AuthUser } from '../../application/ports/services/auth.service';
import { AuthenticationError } from '../../domain/errors/domain-error';
import { requireEnv } from '../../shared/config/env';
import { createClient } from './supabase';

export class SupabaseAuthService implements AuthService {
  private readonly supabase;

  constructor({ request, reply }: { request: FastifyRequest; reply: FastifyReply }) {
    this.supabase = createClient(request, reply);
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'user' },
      },
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
    } catch {
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
      throw new AuthenticationError(error.message);
    }

    if (!data.user || !data.session) {
      throw new AuthenticationError('Login failed: no user data returned');
    }

    return {
      id: data.user.id,
      email: data.user.email!,
    };
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
