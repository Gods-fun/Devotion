When you use the devotion program and dapp [please tag us in your launch announcement.](https://x.com/godsdotfun) 

Join the [Gods Telegram channel!](http://gods.fun)  

Join [ai16z Discord!](https://discord.gg/478N45NWQ6)

![lina_devotion1](https://github.com/user-attachments/assets/65315cbc-99a1-4f40-9f6b-9effa94768ae)

---

# ⚠️ Disclaimer

**This program has not been audited.**

Use this software at your own risk. It may contain bugs, vulnerabilities, or unintended behaviors. **Loss of funds is possible.**  

The maintainers of this repository are not responsible for any losses, damages, or other consequences arising from the use of this program.

---

## Devotion

This program brings divine economics to Solana, where your loyalty is measured in tokens and time. Use devote to stake tokens and grow your devotion over time, unlocking greater rewards in Initial Godly Offerings (IGOs). If doubts creep in, waver allows you to withdraw tokens but resets your devotion to zero. For those ready to renounce divine favor entirely, heresy lets you close your account and reclaim your tokens at the cost of eternal banishment. Curious about your standing? check_devotion calculates your accumulated loyalty, determining your allocation weight in the celestial realm. Prove your devotion, and let the gods decide your fate!

`initialize` allows developers to set the interval for Devotion growth per token, the maximum amount of Devotion that can charge for each token, and the desired agent token's mint address
`devote` allows users to stake tokens and build Devotion.  Devotion grows over time until the maximum devotion charge time.
`waver` allows users to unstake some tokens.  This will reset your Devotion to zero.  Devote responsibly mortal.
`heresy` will withdraw all staked tokens and refund the user's account rent SOL.
`check_devotion` returns the real-time Devotion score of a user and enables other Solana programs to interact with users based on their devotion.

## Setup

- Clone the repo `git clone https://github.com/Gods-fun/Devotion.git`
- [Here are instructions for setting up your environment with Solana CLI tools.](https://solana.com/docs/intro/installation)  You will need to install Rust, Solana and Anchor.
- [If you don't have Node and NPM you will need to install those as well.](https://nodejs.org/en/download)
- Install your dependencies from the root directory `./devotion` `npm install`

## Keys

You will have two keypairs for this:

1. Your deployer address key.
2. A special key specifically to deploy and/or upgrade the devotion program.

- Generate a new keypair for your program: 
```
# For starts-with pattern:
solana-keygen grind --starts-with <pattern>

# For ends-with pattern:
solana-keygen grind --ends-with <pattern>

# You can also specify number of threads to speed up the process
solana-keygen grind --starts-with <pattern> --num-threads 4
```

- Move your new keypair to  `.anchor/target/deploy/devotion-keypair.json`:

```
solana-keygen new -o ./anchor/target/deploy/devotion-keypair.json
```

- You can always inspect a keypair.json file:

```
solana-keygen pubkey ./target/deploy/devotion-keypair.json
```

- Check your listed keys:

```
solana address
# or for more details including file paths
solana config get
```

- If you don't have a default key yet:

```
solana-keygen new
```

- Set our provider cluster to devnet:

```
$ solana config set --url https://api.devnet.solana.com
```

- Fund your default key:
```
solana airdrop 5 <default_key_address>
```

![lina_devotion5](https://github.com/user-attachments/assets/3dd418d8-87c7-4799-83ed-3932fbf2aa6b)

## Check and Set Your ProgramId

- Double triple quadruple check this key: `./anchor/target/deploy/devotion-keypair.json` double check this keypair's public key as it will become your new program's upgrade key and the programId.

- If you do not generate a fresh key and closely follow the next steps - you will likely have a broken program or app with non-sensical errors.

- Set this new program keypair's public address as the programId in the `declareId!()` macro at the top of the Devotion Rust program `./anchor/program/devotion/src/lib.rs`

- Run `anchor keys sync` and then check that the correct programId has been placed in:
    - `./anchor/anchor.toml`
    - `./anchor/target/idl/devotion.json`
    - `./anchor/target/types/devotion.ts`
    - **THIS DOESN'T SYNC:** You always manually have to update the programId here. `./anchor/src/devotion-exports.ts`

- Run `anchor build` from the `./anchor/` folder.

## Deploy

- Now we can deploy our program to devnet or to localnet `anchor deploy --provider.cluster devnet`

- If all of your programIds were not synced before you deployed your program, your Solana program might be bricked and you are currently ripping your hair out.

![lina_devotion3](https://github.com/user-attachments/assets/56f01f21-391e-401d-93c8-dc12b5466f15)

## Deploy a Test Token

- [The Solana SPL-Token docs can be found here.](https://spl.solana.com/token)

- Deploy a new token for testing `spl-token create-token`
- Create a token account for your wallet for holding the new token: `spl-token create-account <token_address>`
- Mint some of the new token to your account: `spl-token mint <token_address> 1000000`
- Airdrop Solana wallet to a test wallet from a Solana wallet in your browser (my favorite is Phantom wallet): `solana airdrop 5 <test_wallet_address>`
- Transfer tokens and create an account for your test wallet: `spl-token transfer --fund-recipient <token_address> 1000000 <test_wallet_address>`


## Running the Dapp

- Fire up the Dapp by running `npm run dev`
- Go to a browser and checkout the app on your local host most likely `http://localhost:3000/`
- In the Devotion Program tab you will see the options to initialize your devotion program:

1. Input your new test tokens address.
2. The interval is the length of time in seconds required to charge 1 point of devotion when you have staked 1 token.
3. The max_devotion_charge is the number of seconds your devotion will accumulate before it is capped.

### Functions:

- `devote` to add tokens and start gaining a devotion score.
- You can devote more tokens at any time.
- `waver` to remove staked tokens but be careful because wavering will reset your devotion to zero - even if you only unstake one token.
- `heresy` to remove all staked tokens and close your account - you will receive a SOL refund from your unused account rent.

![lina_devotion4](https://github.com/user-attachments/assets/86b76203-dc63-4f99-824b-fc60fad730f1)

If you get stuck trying to make this work or you need help please @ me; st4rgard3n in the [ai16z Discord](https://discord.gg/478N45NWQ6)
