# Devotion Program Documentation

---

**If you decide to use this program tag @GodsDotFun in your announcement.  We would love to support you!**

**Warning: This is experimental open source software that has not been audited. Use it at your own risk. Interacting with this software could result in the loss of funds.**

*Built with ❤️ for agent developers everywhere by https://gods.fun and https://*

---

## Core Concepts

The Devotion program is designed as a flexible framework for tokenized agent developers to create engagement mechanics and measure user dedication. Here's what makes it special:

### Key Features

- **Simple but Powerful**: A straightforward staking mechanism that tracks user commitment over time
- **Unopinionated Design**: Built to be composable and adaptable to various use cases
- **Onchain Integration**: Utilize the `check_devotion` instruction handler for onchain mechanics and games
- **Community Metrics**: Enable agent developers to measure community stickiness and long-term dedication
- **Offchain Applications**: Connect wallet activity to social profiles to enhance agent-user interactions

### Use Cases

1. **Agent Behavior Modification**
   - Agents can adapt their responses based on a user's devotion level
   - Enable premium features for highly devoted users

2. **Community Engagement**
   - Track and reward long-term community members
   - Create tiered access systems based on devotion levels

3. **Game Mechanics**
   - Use devotion scores as in-game currency or power-ups
   - Create exclusive content gates based on devotion thresholds

## Mechanics

### Initialization
The program must be initialized with two key parameters:
- `interval`: The time period (in seconds) used to calculate devotion rates
- `max_devotion_charge`: The maximum time multiplier for devotion accumulation

These parameters determine how quickly users can accumulate devotion and the maximum devotion possible for a given stake amount.

### Core Functions

#### Devote (Staking)
The `devote` function allows users to stake tokens and begin accumulating devotion:
- Tokens are transferred from the user's wallet to their program vault
- Devotion accumulates linearly over time based on:
  - Amount of tokens staked
  - Time elapsed since last stake
  - Program's interval setting
- Accumulated devotion is capped by the `max_devotion_charge` parameter
- Previous devotion is preserved as "residual devotion" when adding more tokens

#### Waver (Unstaking)
The `waver` function enables users to withdraw their staked tokens:
- Specified amount of tokens are returned to the user's wallet
- Remaining stake continues accumulating devotion
- All accumulated devotion is reset to zero
- New devotion accumulation begins from the withdrawal timestamp

#### Heresy (Account Closure)
The `heresy` function allows users to completely exit the program:
- All staked tokens are returned to the user's wallet
- User's devotion account is closed
- All accumulated devotion is permanently lost
- Account rent is refunded to the user

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: Required for running JavaScript/TypeScript code.
- **Rust**: Required for building Solana programs.
- **Solana CLI**: Required for interacting with the Solana blockchain.
- **Anchor CLI**: Required for building and deploying Anchor programs.

## Installation

### Install Solana CLI

1. **Download and install the Solana CLI**:

   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.10.32/install)"
   ```

2. **Add Solana to your PATH**:

   ```bash
   export PATH="/home/your-username/.local/share/solana/install/active_release/bin:$PATH"
   ```

3. **Verify the installation**:

   ```bash
   solana --version
   ```

### Install Rust

1. **Install Rust using rustup**:

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Configure your current shell**:

   ```bash
   source $HOME/.cargo/env
   ```

3. **Verify the installation**:

   ```bash
   rustc --version
   ```

### Install Anchor CLI

1. **Install Anchor**:

   ```bash
   cargo install --git https://github.com/coral-xyz/anchor --tag v0.24.2 anchor-cli --locked
   ```

2. **Verify the installation**:

   ```bash
   anchor --version
   ```

## Setting Up the Anchor Project

### Configure Wallet

1. **Check your current configured wallet address**:

   ```bash
   solana address
   ```

2. **Set your Solana cluster to devnet**:

   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

### Set Program ID

1. **Generate a new keypair for your program**:

   ```bash
   solana-keygen new --outfile ./target/deploy/devotion-keypair.json
   ```

2. **Set the program ID in `Anchor.toml`**:

   Open `Anchor.toml` and set the `program` section to use your new keypair:

   ```toml
   [programs.devnet]
   devotion = "YourProgramIDHere"
   ```

3. **Sync keys**:

   ```bash
   anchor keys sync
   ```

## Building and Deploying

1. **Build the program**:

   ```bash
   anchor build
   ```

2. **Deploy the program**:

   ```bash
   anchor deploy
   ```

## Running Tests

1. **Run the tests**:

   ```bash
   anchor test
   ```

   This will execute the tests defined in `tests/devotion.ts`.

## Additional Information

- **Program Keypair**: The keypair file is located at `target/deploy/devotion-keypair.json`.
- **Program ID**: Ensure the program ID in `Anchor.toml` matches the one generated for your keypair.

For more detailed information, refer to the [Anchor documentation](https://project-serum.github.io/anchor/getting-started/introduction.html).

---

This documentation provides a step-by-step guide for setting up your development environment, configuring your project, and running tests. Adjust the paths and versions as necessary for your specific setup.
