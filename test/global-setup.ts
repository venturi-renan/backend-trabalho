import { execSync } from 'node:child_process';
import { testEnv } from './test-env';

export default function setup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL },
    stdio: 'ignore',
  });
}
