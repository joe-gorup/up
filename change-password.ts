import { hashPassword } from './server/auth';

// Usage: tsx change-password.ts "your-new-password"
async function main() {
  const newPassword = process.argv[2];
  
  if (!newPassword) {
    console.error('Usage: tsx change-password.ts "your-new-password"');
    process.exit(1);
  }
  
  console.log('\n🔐 Generating bcrypt hash (12 rounds)...\n');
  const hash = await hashPassword(newPassword);
  console.log('Password:', newPassword);
  console.log('Hash:', hash);
  console.log('\n📋 Copy the hash above and use it in your SQL UPDATE command.\n');
}

main();
