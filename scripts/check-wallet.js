const { exec } = require('child_process');

function checkBalance() {
  exec('solana balance', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error checking balance: ${error}`);
      process.exit(1);
    }
    const balance = parseFloat(stdout);
    if (balance < 1) {
      console.error('Insufficient balance');
      process.exit(1);
    }
    console.log(`Wallet balance: ${balance} SOL`);
    process.exit(0);
  });
}

checkBalance(); 