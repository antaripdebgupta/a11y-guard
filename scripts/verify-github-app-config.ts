import fs from 'fs';
import path from 'path';
import { parseEnv } from '../packages/config/src/index.js';
import { createLogger } from '../packages/logger/src/index.js';

async function verifyGitHubAppConfig() {
  const logger = createLogger('verify-github-app');
  logger.info('Verifying GitHub App configuration...');

  try {
    const env = parseEnv();
    const appId = env.GITHUB_APP_ID;
    const keyPath = path.resolve(process.cwd(), env.GITHUB_APP_PRIVATE_KEY_PATH);

    logger.info({ appId, keyPath }, 'Reading GitHub App parameters from environment');

    if (!fs.existsSync(keyPath)) {
      logger.warn(
        { keyPath },
        `GitHub App private key file not found at path "${keyPath}". Please follow SETUP.md to obtain a private key file for local integration.`,
      );
      process.exit(0);
    }

    const privateKey = fs.readFileSync(keyPath, 'utf8');
    if (!privateKey.includes('PRIVATE KEY')) {
      logger.error('The key file exists but does not appear to be a valid PEM private key.');
      process.exit(1);
    }

    logger.info(
      'GitHub App configuration parameters and private key format validated successfully.',
    );
  } catch (error) {
    logger.error({ error }, 'Failed to verify GitHub App configuration.');
    process.exit(1);
  }
}

void verifyGitHubAppConfig();
