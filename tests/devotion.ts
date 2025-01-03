import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Devotion } from "../target/types/devotion";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddress, createAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

// Add this at the top of your test file
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test with different decimal configurations
const TEST_DECIMALS = 6; // Let's test with 6 decimals (like USDC)
const TOKEN_DECIMALS = 10 ** TEST_DECIMALS;

const SECONDS_PER_DAY = 86_400;
const DEFAULT_INTERVAL = SECONDS_PER_DAY; // 1 day in seconds
const DEFAULT_MAX_DEVOTION_CHARGE = SECONDS_PER_DAY * 180; // 180 days in seconds

function formatAmount(amount: number | anchor.BN, decimals: number = TEST_DECIMALS): string {
  const bn = amount instanceof anchor.BN ? amount : new anchor.BN(amount);
  return `${bn.toString()} raw (${bn.div(new anchor.BN(10 ** decimals)).toString()} tokens)`;
}

describe("devotion", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Devotion as Program<Devotion>;
  
  // We'll use these keypairs throughout our tests
  const admin = Keypair.generate();
  let stakeMint: PublicKey;
  
  // PDAs we'll need
  let stakeStateAddress: PublicKey;
  let totalDevotedAddress: PublicKey;
  
  // Add these variables after the existing ones
  let userKeypair: Keypair;
  let userTokenAccount: PublicKey;
  let userVaultAddress: PublicKey;
  let devotedAddress: PublicKey;
  
  before(async () => {
    console.log("\n=== Starting Test Setup ===");
    console.log("Program ID:", program.programId.toString());
    console.log("Admin Public Key:", admin.publicKey.toString());
    
    // Airdrop SOL to admin
    console.log("\nAirdropping 2 SOL to admin...");
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    console.log("Airdrop successful:", signature);
    
    // Create stake mint
    console.log("\nCreating stake mint...");
    stakeMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      TEST_DECIMALS
    );
    console.log("Stake mint created:", stakeMint.toString());
    console.log("Stake mint decimals:", TEST_DECIMALS);
    
    // Derive PDAs
    console.log("\nDeriving Program PDAs...");
    [stakeStateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );
    console.log("State PDA:", stakeStateAddress.toString());
    
    [totalDevotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("total_devoted")],
      program.programId
    );
    console.log("Total Devoted PDA:", totalDevotedAddress.toString());
    
    // Log admin balance after airdrop
    const balance = await provider.connection.getBalance(admin.publicKey);
    console.log("\nAdmin balance after setup:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    
    console.log("\n=== Setup Complete ===\n");
    
    // Add these lines at the end of the before block
    userKeypair = Keypair.generate();
    
    // Airdrop SOL to user
    const userAirdropSignature = await provider.connection.requestAirdrop(
      userKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(userAirdropSignature);

    // Create user's token account
    userTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      userKeypair,
      stakeMint,
      userKeypair.publicKey
    );

    // Mint 2 million tokens to user (increased from 1 million)
    await mintTo(
      provider.connection,
      admin,
      stakeMint,
      userTokenAccount,
      admin,
      2_000_000 * TOKEN_DECIMALS
    );

    // Derive PDAs for user
    [userVaultAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), userKeypair.publicKey.toBytes()],
      program.programId
    );

    [devotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("devoted"), userKeypair.publicKey.toBytes()],
      program.programId
    );
  });

  it("Initializes the program state", async () => {
    try {
      const tx = await program.methods
        .initialize(
          new anchor.BN(DEFAULT_INTERVAL),
          new anchor.BN(DEFAULT_MAX_DEVOTION_CHARGE)
        )
        .accounts({
          admin: admin.publicKey,
          stakeMint: stakeMint,
          stakeState: stakeStateAddress,
          totalDevoted: totalDevotedAddress,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([admin])
        .rpc();
      
      console.log("\n=== Transaction Completed ===");
      console.log("Transaction signature:", tx);

      // Fetch and log the created accounts
      console.log("\n=== Fetching Created Accounts ===");
      const stateAccount = await program.account.stakeState.fetch(stakeStateAddress);
      const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);
      
      console.log("\nState Account Data:");
      console.log("- Admin:", stateAccount.admin.toString());
      console.log("- Stake Mint:", stateAccount.stakeMint.toString());
      console.log("- Interval:", stateAccount.interval.toString(), "seconds");
      console.log("- Max Devotion Charge:", stateAccount.maxDevotionCharge.toString(), "seconds");

      console.log("\nTotal Devoted Account Data:");
      console.log("- Total Tokens:", totalDevotedAccount.totalTokens.toString());
      assert.equal(totalDevotedAccount.totalTokens.toString(), "0", "Total tokens should be 0");
      
      // Verify the accounts were initialized correctly
      assert.ok(stateAccount.admin.equals(admin.publicKey), "Admin public key mismatch");
      assert.ok(stateAccount.stakeMint.equals(stakeMint), "Stake mint mismatch");
      assert.ok(stateAccount.interval.eq(new anchor.BN(DEFAULT_INTERVAL)), "Interval mismatch");
      assert.ok(stateAccount.maxDevotionCharge.eq(new anchor.BN(DEFAULT_MAX_DEVOTION_CHARGE)), "Max devotion charge mismatch");
      assert.equal(totalDevotedAccount.totalTokens.toString(), "0", "Total tokens should be 0");
      
      console.log("Your transaction signature", tx);
      console.log("\n=== All Assertions Passed ===");
    } catch (err) {
      console.error("\n=== Error During Initialization ===");
      console.error("Error details:", err);
      throw err;
    }
  });

  it("Cannot reinitialize the program state", async () => {
    try {
      await program.methods
        .initialize(
          new anchor.BN(DEFAULT_INTERVAL),
          new anchor.BN(DEFAULT_MAX_DEVOTION_CHARGE)
        )
        .accounts({
          admin: admin.publicKey,
          stakeMint: stakeMint,
          stakeState: stakeStateAddress,
          totalDevoted: totalDevotedAddress,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([admin])
        .rpc();
        
      assert.fail("Should not be able to reinitialize the program");
    } catch (error) {
      assert.include(
        error.message,
        "already in use",
        "Expected error about account already being initialized"
      );
    }
  });

  it("Cannot reinitialize a user's devoted account through devote", async () => {
    // First devote to create the account
    const initialAmount = new anchor.BN(100_000).mul(new anchor.BN(TOKEN_DECIMALS));
    await program.methods
      .devote(initialAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    // Now get the initial state after first devote
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    const initialTimestamp = initialDevoted.lastStakeTimestamp;
    const initialResidualDevotion = initialDevoted.residualDevotion;
    
    // Wait a bit to ensure timestamp would be different
    await sleep(1000);
    
    // Try to devote with amount = 0, which should still process but not reinitialize
    try {
      await program.methods
        .devote(new anchor.BN(0))
        .accounts({
          user: userKeypair.publicKey,
          stakeState: stakeStateAddress,
          userVault: userVaultAddress,
          userTokenAccount: userTokenAccount,
          stakeMint: stakeMint,
          devoted: devotedAddress,
          totalDevoted: totalDevotedAddress,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      // Fetch the devoted account after the transaction
      const finalDevoted = await program.account.devoted.fetch(devotedAddress);
      
      // Verify that the important state wasn't reset
      assert.ok(
        finalDevoted.lastStakeTimestamp.gt(initialTimestamp),
        "Timestamp should be updated, not reset to 0"
      );
      assert.ok(
        finalDevoted.residualDevotion.gte(initialResidualDevotion),
        "Residual devotion should not decrease"
      );
      
    } catch (error) {
      // If it fails, it should only be because of a different constraint
      // not because of reinitialization
      assert.notInclude(
        error.message,
        "already in use",
        "Should not fail due to initialization constraint"
      );
    }
  });

  it("Can devote tokens", async () => {
    // Get initial state
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    const initialAmount = initialDevoted.amount;
    
    const amountToDevote = new anchor.BN(600_000).mul(new anchor.BN(TOKEN_DECIMALS));

    const tx = await program.methods
      .devote(amountToDevote)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Devote transaction signature:", tx);

    // Fetch and verify the accounts
    const devotedAccount = await program.account.devoted.fetch(devotedAddress);
    const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);
    const vaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);

    // Verify the devoted account
    assert.ok(devotedAccount.user.equals(userKeypair.publicKey), "Wrong user in devoted account");
    assert.ok(devotedAccount.amount.eq(initialAmount.add(amountToDevote)), "Wrong amount in devoted account");
    assert.ok(devotedAccount.lastStakeTimestamp.toNumber() > 0, "Last stake timestamp should be set");

    // Verify the total devoted
    assert.ok(totalDevotedAccount.totalTokens.eq(initialAmount.add(amountToDevote)), "Wrong total devoted amount");

    // Verify the vault balance
    assert.equal(
      vaultBalance.value.amount,
      initialAmount.add(amountToDevote).toString(),
      "Wrong vault balance"
    );
  });

  it("Can add to existing devotion", async () => {
    // Get initial balances and state
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const initialUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    
    console.log("\n=== Initial State ===");
    console.log("Initial vault balance:", formatAmount(initialVaultBalance.value.amount));
    console.log("Initial user token balance:", formatAmount(initialUserBalance.value.amount));
    console.log("Initial devoted amount:", formatAmount(initialDevoted.amount));
    console.log("Initial residual devotion:", formatAmount(initialDevoted.residualDevotion));

    // Get initial slot and timestamp
    let slot = await provider.connection.getSlot();
    let initialTimestamp = (await provider.connection.getBlockTime(slot)) as number;
    console.log("\nInitial timestamp:", new Date(initialTimestamp * 1000).toISOString());

    await provider.connection.requestAirdrop(provider.wallet.publicKey, 1);
    await sleep(1000); // Small delay to ensure slot advancement

    // Get new timestamp
    slot = await provider.connection.getSlot();
    const newTimestamp = (await provider.connection.getBlockTime(slot)) as number;
    console.log("New timestamp:", new Date(newTimestamp * 1000).toISOString());
    console.log("Time difference:", (newTimestamp - initialTimestamp), "seconds");

    const additionalAmount = new anchor.BN(400_000).mul(new anchor.BN(TOKEN_DECIMALS));
    console.log("\nAdditional amount to devote:", formatAmount(additionalAmount));

    // Get initial devotion
    const initialDevotion = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
        stakeState: stakeStateAddress,
      })
      .view();

    console.log("Initial devotion score:", formatAmount(initialDevotion));

    const devoteTx = await program.methods
      .devote(additionalAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    console.log("\nAdditional devote transaction signature:", devoteTx);

    // Fetch and verify the accounts after the transaction
    const finalDevotedAccount = await program.account.devoted.fetch(devotedAddress);
    const finalTotalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const finalUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);

    console.log("\n=== Final State ===");
    console.log("Final vault balance:", formatAmount(finalVaultBalance.value.amount));
    console.log("Final user token balance:", formatAmount(finalUserBalance.value.amount));
    console.log("Final devoted amount:", formatAmount(finalDevotedAccount.amount));
    console.log("Final residual devotion:", formatAmount(finalDevotedAccount.residualDevotion));
    console.log("Total devoted in program:", formatAmount(finalTotalDevotedAccount.totalTokens));

    // Verify the total amount is now the sum of both deposits
    const expectedTotal = initialDevoted.amount.add(additionalAmount);
    assert.ok(finalDevotedAccount.amount.eq(expectedTotal), "Wrong total amount after second deposit");
    assert.ok(finalTotalDevotedAccount.totalTokens.eq(expectedTotal), "Wrong total devoted after second deposit");
  });

  it("Can waver", async () => {
    // Get initial balances and state
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const initialUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    const initialTotalDevoted = await program.account.totalDevoted.fetch(totalDevotedAddress);
    
    console.log("\n=== Initial State ===");
    console.log("Initial vault balance:", formatAmount(initialVaultBalance.value.amount));
    console.log("Initial user token balance:", formatAmount(initialUserBalance.value.amount));
    console.log("Initial devoted amount:", formatAmount(initialDevoted.amount));
    console.log("Initial total devoted:", formatAmount(initialTotalDevoted.totalTokens));

    // Amount to withdraw (let's withdraw half of the devoted tokens)
    const withdrawAmount = initialDevoted.amount.div(new anchor.BN(2));
    console.log("\nWithdrawing amount:", formatAmount(withdrawAmount));

    const waverTx = await program.methods
      .waver(withdrawAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Waver transaction signature:", waverTx);

    // Fetch final states
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const finalUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const finalDevoted = await program.account.devoted.fetch(devotedAddress);
    const finalTotalDevoted = await program.account.totalDevoted.fetch(totalDevotedAddress);

    console.log("\n=== Final State ===");
    console.log("Final vault balance:", formatAmount(finalVaultBalance.value.amount));
    console.log("Final user token balance:", formatAmount(finalUserBalance.value.amount));
    console.log("Final devoted amount:", formatAmount(finalDevoted.amount));
    console.log("Final total devoted:", formatAmount(finalTotalDevoted.totalTokens));

    // Verify the accounts were updated correctly
    assert.ok(
      finalDevoted.amount.eq(initialDevoted.amount.sub(withdrawAmount)),
      "Devoted amount not reduced correctly"
    );
    
    assert.ok(
      finalTotalDevoted.totalTokens.eq(initialTotalDevoted.totalTokens.sub(withdrawAmount)),
      "Total devoted not reduced correctly"
    );

    // Verify user received their tokens
    const userBalanceDiff = new anchor.BN(finalUserBalance.value.amount)
      .sub(new anchor.BN(initialUserBalance.value.amount));
    assert.ok(
      userBalanceDiff.eq(withdrawAmount),
      "User didn't receive correct amount of tokens"
    );

    // Verify vault balance reduced
    const vaultBalanceDiff = new anchor.BN(initialVaultBalance.value.amount)
      .sub(new anchor.BN(finalVaultBalance.value.amount));
    assert.ok(
      vaultBalanceDiff.eq(withdrawAmount),
      "Vault balance not reduced correctly"
    );

    // Verify residual devotion was reset
    assert.equal(
      finalDevoted.residualDevotion.toNumber(),
      0,
      "Residual devotion should be reset to 0"
    );

    console.log("\n=== All Assertions Passed ===");
  });

  it("Can commit heresy", async () => {
    // Get initial balances
    const initialUserSol = await provider.connection.getBalance(userKeypair.publicKey);
    const initialUserTokens = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);

    console.log("\n=== Initial State ===");
    console.log("Initial user SOL balance:", formatAmount(initialUserSol));
    console.log("Initial user token balance:", formatAmount(initialUserTokens.value.amount));
    console.log("Initial vault balance:", formatAmount(initialVaultBalance.value.amount));
    console.log("Initial devoted amount:", formatAmount(initialDevoted.amount));

    const heresyTx = await program.methods
      .heresy()
      .accounts({
        user: userKeypair.publicKey,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Heresy transaction signature:", heresyTx);

    // Get final balances
    const finalUserSol = await provider.connection.getBalance(userKeypair.publicKey);
    const finalUserTokens = await provider.connection.getTokenAccountBalance(userTokenAccount);

    console.log("\n=== Final State ===");
    console.log("Final user SOL balance:", formatAmount(finalUserSol));
    console.log("Final user token balance:", formatAmount(finalUserTokens.value.amount));
    
    // Verify SOL balance increased (account rent was returned from devoted account)
    assert.isTrue(
        finalUserSol > initialUserSol,
        "User should have received rent SOL back from closed devoted account"
    );
    console.log("SOL returned to user:", formatAmount(finalUserSol - initialUserSol));

    // Verify token balance increased by the vault's tokens
    const tokenIncrease = new anchor.BN(finalUserTokens.value.amount)
        .sub(new anchor.BN(initialUserTokens.value.amount));
    assert.ok(
        tokenIncrease.eq(initialDevoted.amount),
        "User token balance should have increased by the vault amount"
    );
    console.log("Tokens returned to user:", formatAmount(tokenIncrease));

    // Verify devoted account is closed
    const devotedAccount = await provider.connection.getAccountInfo(devotedAddress);
    assert.isNull(devotedAccount, "Devoted account should be closed");

    // Verify total devoted is updated
    const finalTotalDevoted = await program.account.totalDevoted.fetch(totalDevotedAddress);
    assert.ok(
        finalTotalDevoted.totalTokens.eq(new anchor.BN(0)),
        "Total devoted should be zero"
    );

    console.log("\n=== All Assertions Passed ===");
  });

  it("Cannot devote on behalf of another user", async () => {
    // Create a second user
    const maliciousUser = Keypair.generate();
    
    // Airdrop SOL to malicious user
    const airdropSig = await provider.connection.requestAirdrop(
      maliciousUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token account for malicious user
    const maliciousTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      maliciousUser,
      stakeMint,
      maliciousUser.publicKey
    );

    // Mint some tokens to malicious user
    await mintTo(
      provider.connection,
      admin,
      stakeMint,
      maliciousTokenAccount,
      admin,
      100_000 * TOKEN_DECIMALS
    );

    // Try to devote tokens to the original user's vault
    const amountToDevote = new anchor.BN(50_000).mul(new anchor.BN(TOKEN_DECIMALS));
    
    try {
      await program.methods
        .devote(amountToDevote)
        .accounts({
          user: maliciousUser.publicKey,
          stakeState: stakeStateAddress,
          userVault: userVaultAddress, // Trying to use original user's vault
          userTokenAccount: maliciousTokenAccount,
          stakeMint: stakeMint,
          devoted: devotedAddress, // Trying to use original user's devoted account
          totalDevoted: totalDevotedAddress,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([maliciousUser])
        .rpc();
      
      assert.fail("Should not be able to devote to another user's vault");
    } catch (error) {
      assert.include(
        error.message,
        "AnchorError caused by account: user_v",
        "Expected Anchor error due to invalid vault account"
      );
    }
  });

  it("Cannot waver another user's tokens", async () => {
    // Create a second user
    const maliciousUser = Keypair.generate();
    
    // Airdrop SOL to malicious user
    const airdropSig = await provider.connection.requestAirdrop(
      maliciousUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token account for malicious user
    const maliciousTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      maliciousUser,
      stakeMint,
      maliciousUser.publicKey
    );

    // Try to withdraw from original user's vault
    const withdrawAmount = new anchor.BN(50_000).mul(new anchor.BN(TOKEN_DECIMALS));
    
    try {
      await program.methods
        .waver(withdrawAmount)
        .accounts({
          user: maliciousUser.publicKey,
          stakeState: stakeStateAddress,
          userVault: userVaultAddress, // Trying to use original user's vault
          userTokenAccount: maliciousTokenAccount,
          stakeMint: stakeMint,
          devoted: devotedAddress, // Trying to use original user's devoted account
          totalDevoted: totalDevotedAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maliciousUser])
        .rpc();
      
      assert.fail("Should not be able to waver another user's tokens");
    } catch (error) {
      assert.include(
        error.message,
        "AnchorError caused by account: devoted",
        "Expected Anchor error due to invalid devoted account"
      );
    }
  });

  it("Cannot commit heresy on another user's accounts", async () => {
    // Create a second user
    const maliciousUser = Keypair.generate();
    
    // Airdrop SOL to malicious user
    const airdropSig = await provider.connection.requestAirdrop(
      maliciousUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token account for malicious user
    const maliciousTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      maliciousUser,
      stakeMint,
      maliciousUser.publicKey
    );

    try {
      await program.methods
        .heresy()
        .accounts({
          user: maliciousUser.publicKey,
          userVault: userVaultAddress, // Trying to use original user's vault
          userTokenAccount: maliciousTokenAccount,
          stakeMint: stakeMint,
          devoted: devotedAddress, // Trying to use original user's devoted account
          totalDevoted: totalDevotedAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maliciousUser])
        .rpc();
      
      assert.fail("Should not be able to commit heresy on another user's accounts");
    } catch (error) {
      assert.include(
        error.message,
        "AnchorError caused by account: devoted",
        "Expected Anchor error due to invalid devoted account"
      );
    }
  });

  // Add a new test to verify decimal handling
  it("Correctly handles token decimals", async () => {
    // Fetch the stake state to verify decimals were stored correctly
    const stakeState = await program.account.stakeState.fetch(stakeStateAddress);
    assert.equal(
      stakeState.decimals,
      TEST_DECIMALS,
      "Stake state should store correct decimals"
    );

    // Test with small amount (1 token)
    const smallAmount = new anchor.BN(TOKEN_DECIMALS); // 1 full token
    await program.methods
      .devote(smallAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    // Verify vault balance
    const vaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    assert.equal(
      vaultBalance.value.decimals,
      TEST_DECIMALS,
      "Token account should have correct decimals"
    );
    assert.equal(
      vaultBalance.value.amount,
      smallAmount.toString(),
      "Vault should have correct raw amount"
    );
    assert.equal(
      vaultBalance.value.uiAmount,
      1,
      "Vault should have 1 token in UI amount"
    );

    // Test devotion calculation with different decimals
    const devotion = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
        stakeState: stakeStateAddress,
      })
      .view();

    console.log("\nDevotion test with decimals:");
    console.log("Raw amount staked:", smallAmount.toString());
    console.log("UI amount staked:", smallAmount.div(new anchor.BN(TOKEN_DECIMALS)).toString());
    console.log("Raw devotion score:", devotion.toString());
    console.log("UI devotion score:", new anchor.BN(devotion.toString())
      .div(new anchor.BN(TOKEN_DECIMALS)).toString());

    // Test with fractional amount (0.5 tokens)
    const fractionalAmount = new anchor.BN(TOKEN_DECIMALS).div(new anchor.BN(2));
    await program.methods
      .devote(fractionalAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    // Verify fractional amounts are handled correctly
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const expectedTotal = smallAmount.add(fractionalAmount);
    assert.equal(
      finalVaultBalance.value.amount,
      expectedTotal.toString(),
      "Vault should handle fractional amounts correctly"
    );
    assert.equal(
      finalVaultBalance.value.uiAmount,
      1.5,
      "Vault should show correct UI amount with fractions"
    );
  });

  it("Correctly calculates devotion with different decimal configurations", async () => {
    // First devote a specific amount and wait to accumulate some devotion
    const devoteAmount = new anchor.BN(100).mul(new anchor.BN(TOKEN_DECIMALS)); // 100 tokens
    await program.methods
      .devote(devoteAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    // Get initial state
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    console.log("\n=== Initial Devotion State ===");
    console.log("Amount staked:", formatAmount(initialDevoted.amount));
    console.log("Initial residual devotion:", formatAmount(initialDevoted.residualDevotion));
    console.log("Initial timestamp:", new Date(initialDevoted.lastStakeTimestamp.toNumber() * 1000).toISOString());

    // Wait for some time to accumulate devotion
    await sleep(2000);

    // Check devotion after waiting
    const devotionAfterWait = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
        stakeState: stakeStateAddress,
      })
      .view();

    console.log("\n=== Devotion After Wait ===");
    console.log("Raw devotion score:", devotionAfterWait.toString());
    console.log("UI devotion score:", formatAmount(devotionAfterWait));

    // Now devote a small amount to update residual_devotion
    const smallAmount = new anchor.BN(1).mul(new anchor.BN(TOKEN_DECIMALS)); // 1 token
    await program.methods
      .devote(smallAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stakeStateAddress,
        userVault: userVaultAddress,
        userTokenAccount: userTokenAccount,
        stakeMint: stakeMint,
        devoted: devotedAddress,
        totalDevoted: totalDevotedAddress,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userKeypair])
      .rpc();

    // Check state after small devote
    const afterSmallDevote = await program.account.devoted.fetch(devotedAddress);
    console.log("\n=== After Small Devote ===");
    console.log("New total amount:", formatAmount(afterSmallDevote.amount));
    console.log("New residual devotion:", formatAmount(afterSmallDevote.residualDevotion));
    console.log("New timestamp:", new Date(afterSmallDevote.lastStakeTimestamp.toNumber() * 1000).toISOString());

    // Verify residual devotion was stored correctly
    assert.ok(
      afterSmallDevote.residualDevotion.eq(devotionAfterWait),
      "Residual devotion should match previous devotion score"
    );

    // Wait again to accumulate more devotion
    await sleep(2000);

    // Check final devotion
    const finalDevotion = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
        stakeState: stakeStateAddress,
      })
      .view();

    console.log("\n=== Final Devotion Check ===");
    console.log("Raw final devotion:", finalDevotion.toString());
    console.log("UI final devotion:", formatAmount(finalDevotion));

    // Calculate expected devotion range
    const stakeState = await program.account.stakeState.fetch(stakeStateAddress);
    const totalAmount = afterSmallDevote.amount;
    const timeElapsed = 2; // approximately 2 seconds
    
    // Calculate minimum expected devotion (not including residual)
    const minExpectedDevotion = totalAmount
      .mul(new anchor.BN(timeElapsed))
      .div(new anchor.BN(10 ** stakeState.decimals))
      .div(new anchor.BN(stakeState.interval));

    // Add residual to get total minimum expected
    const minTotalExpectedDevotion = minExpectedDevotion.add(afterSmallDevote.residualDevotion);

    console.log("\n=== Devotion Calculations ===");
    console.log("Minimum expected devotion:", formatAmount(minTotalExpectedDevotion));
    console.log("Actual devotion:", formatAmount(finalDevotion));

    // Verify the devotion is at least what we expect
    assert.ok(
      new anchor.BN(finalDevotion.toString()).gte(minTotalExpectedDevotion),
      "Final devotion should be at least the minimum expected amount"
    );

    // Verify it doesn't exceed max devotion
    const maxDevotionCharge = new anchor.BN(stakeState.maxDevotionCharge);
    const maxDevotion = totalAmount
      .mul(maxDevotionCharge)
      .div(new anchor.BN(stakeState.interval));

    assert.ok(
      new anchor.BN(finalDevotion.toString()).lte(maxDevotion),
      "Final devotion should not exceed max devotion"
    );
  });
});
