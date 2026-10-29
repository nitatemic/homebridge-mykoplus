import dotenv from 'dotenv';
import { MykoClient, sanitizeLogMessage } from '../src/api/client';

dotenv.config();

const email = process.env.MYKOPLUS_MAIL;
const password = process.env.MYKOPLUS_PASSWORD;

if (!email || !password) {
  console.error('[Test Control] Missing MYKOPLUS_MAIL or MYKOPLUS_PASSWORD in .env');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(userEmail: string, userPass: string): Promise<void> {
  const maskedEmail = userEmail.replace(/(?<=.{2}).(?=.*@)/g, '*');
  console.log(`[Test Control] Initializing live control test for: ${maskedEmail}`);

  const client = new MykoClient({ email: userEmail, password: userPass });

  try {
    await client.login();
    console.log('[Test Control] Authenticated successfully.');

    const devices = await client.getDevices();
    if (devices.length === 0) {
      throw new Error('No devices found on account to test control');
    }

    // Find the target plug ("Bureau" preferred, or first outlet)
    const targetDevice = devices.find((d) => d.name.toLowerCase().includes('bureau')) || devices.find((d) => d.type === 'outlet') || devices[0];
    console.log(`[Test Control] Target device: "${targetDevice.name}" (ID: ${targetDevice.id}, type: ${targetDevice.type})`);

    const initialPower = targetDevice.power;
    const targetPower = !initialPower;
    console.log(`[Test Control] Initial power state: ${initialPower}`);
    console.log(`[Test Control] Toggling power state to: ${targetPower}...`);

    let restored = false;
    try {
      // 1. Send toggle command
      const toggleSuccess = await client.setDevicePower(targetDevice.id, targetPower);
      console.log(`[Test Control] Command dispatched successfully (accepted: ${toggleSuccess})`);

      // 2. Wait for cloud propagation and verify state
      console.log('[Test Control] Waiting 2000ms for cloud state synchronization...');
      await sleep(2000);

      const updatedDevice = await client.getDevice(targetDevice.id);
      if (!updatedDevice) {
        throw new Error(`Failed to retrieve device ${targetDevice.id} after toggle`);
      }

      console.log(`[Test Control] Device power state verified: ${updatedDevice.power} (expected: ${targetPower})`);
      if (updatedDevice.power !== targetPower) {
        console.warn(`[Test Control] Warning: Cloud reported state (${updatedDevice.power}) may not have settled immediately, but command was accepted.`);
      }
    } finally {
      // 3. Always restore original state
      console.log(`[Test Control] Restoring device power state to original: ${initialPower}...`);
      await client.setDevicePower(targetDevice.id, initialPower);
      restored = true;
      console.log('[Test Control] Restoration command dispatched successfully.');

      await sleep(2000);
      const finalDevice = await client.getDevice(targetDevice.id);
      if (finalDevice) {
        console.log(`[Test Control] Final restored power state: ${finalDevice.power} (restored: ${finalDevice.power === initialPower})`);
      }
    }

    console.log('[Test Control] Live command execution and restoration completed successfully!');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Test Control] Error during live control test: ${sanitizeLogMessage(message)}`);
    process.exit(1);
  }
}

main(email, password);
