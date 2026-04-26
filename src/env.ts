import 'dotenv/config';
import type { Env } from './types';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env: Env = {
  RAKUTEN_APPLICATION_ID: required('RAKUTEN_APPLICATION_ID'),
  RAKUTEN_ACCESS_KEY:     required('RAKUTEN_ACCESS_KEY'),
  RAKUTEN_REFERRER_URL:   process.env['RAKUTEN_REFERRER_URL'],
};
