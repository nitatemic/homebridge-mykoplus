import dotenv from 'dotenv';
dotenv.config();

const email = process.env.MYKOPLUS_MAIL;
const password = process.env.MYKOPLUS_PASSWORD;

if (!email || !password) {
  console.error('Missing MYKOPLUS_MAIL or MYKOPLUS_PASSWORD in .env');
  process.exit(1);
}

console.log('Testing authentication with credentials for:', email);
// The script will test authentication against candidate endpoints and inspect device response
