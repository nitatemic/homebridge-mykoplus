import dotenv from 'dotenv';
import { MykoClient, sanitizeLogMessage } from '../src/api/client';

dotenv.config();

const email = process.env.MYKOPLUS_MAIL;
const password = process.env.MYKOPLUS_PASSWORD;

if (!email || !password) {
  console.error('Missing MYKOPLUS_MAIL or MYKOPLUS_PASSWORD in .env');
  process.exit(1);
}

async function main(userEmail: string, userPass: string): Promise<void> {
  const maskedEmail = userEmail.replace(/(?<=.{2}).(?=.*@)/g, '*');
  console.log(`[Test Auth] Testing authentication for: ${maskedEmail}`);

  const client = new MykoClient({ email: userEmail, password: userPass });

  try {
    const startTime = Date.now();
    await client.login();
    const duration = Date.now() - startTime;
    console.log(`[Test Auth] Login successful (${duration}ms)`);

    const session = client.getSession();
    console.log(`[Test Auth] Session established. User ID: ${client.getUserId() ? '[CONFIRMED]' : '[NOT FOUND]'}`);
    console.log(`[Test Auth] Access Token present: ${Boolean(session?.accessToken)}`);

    console.log('[Test Auth] Discovering devices on user account...');
    const devices = await client.getDevices();
    console.log(`[Test Auth] Successfully discovered ${devices.length} device(s):`);

    for (const device of devices) {
      console.log(`  - [${device.type.toUpperCase()}] "${device.name}" (ID: ${device.id})`);
      console.log(`      Model: ${device.model || 'N/A'}, Online: ${device.online}, Power: ${device.power}`);
    }

    if (devices.length === 0) {
      console.warn('[Test Auth] Warning: 0 devices returned for account.');
    } else {
      console.log('[Test Auth] Authentication and device discovery verification completed successfully.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Test Auth] Error: ${sanitizeLogMessage(message)}`);
    process.exit(1);
  }
}

main(email, password);
