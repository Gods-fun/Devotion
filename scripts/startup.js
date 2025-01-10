const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkAndAirdrop() {
  try {
    // Configure solana for devnet
    await execAsync('solana config set --url devnet');
    
    // Check current balance
    const { stdout } = await execAsync('solana balance');
    const balance = parseFloat(stdout);
    console.log(`Current balance: ${balance} SOL`);

    if (balance < 1) {
      console.log('Balance low, requesting airdrop...');
      try {
        await execAsync('solana airdrop 2');
        console.log('Airdrop successful');
      } catch (error) {
        console.error('Airdrop failed:', error.message);
        // Continue anyway - the app might still work with low balance
      }
    }

    // Start the Next.js application
    console.log('Starting Next.js application...');
    const app = spawn('yarn', ['start'], { stdio: 'inherit' });
    
    app.on('error', (err) => {
      console.error('Failed to start application:', err);
      process.exit(1);
    });

    // Handle SIGTERM and SIGINT
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down...');
      app.kill();
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down...');
      app.kill();
    });

  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
}

checkAndAirdrop(); 