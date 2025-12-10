import { getEnv } from './env';

export const AppConfig = {
  // Registration bonus in MicroPoints (10 Points = 10,000,000 MicroPoints)
  REGISTRATION_BONUS_AMOUNT: BigInt(getEnv('REGISTRATION_BONUS_AMOUNT', '10000000')),
} as const;
