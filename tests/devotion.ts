import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Devotion } from "../target/types/devotion";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddress, createAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

const TOKEN_DECIMALS = 1_000_000_000; // 10^9

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("devotion", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Devotion as Program<Devotion>;
  
  // We'll use these keypairs throughout our tests
  const admin = Keypair.generate();
  let stakeMint: PublicKey;
  
  // PDAs we'll need
  let stateAddress: PublicKey;
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
      9 // decimals
    );
    console.log("Stake mint created:", stakeMint.toString());
    
    // Derive PDAs
    console.log("\nDeriving Program PDAs...");
    [stateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), program.programId.toBytes()],
      program.programId
    );
    console.log("State PDA:", stateAddress.toString());
    
    [totalDevotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("total_devoted"), program.programId.toBytes()],
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

    // Mint 1 million tokens to user (reduced from 200 million)
    await mintTo(
      provider.connection,
      admin,
      stakeMint,
      userTokenAccount,
      admin,
      1_000_000 * TOKEN_DECIMALS
    );

    // Derive PDAs for user
    [userVaultAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), program.programId.toBytes(), userKeypair.publicKey.toBytes()],
      program.programId
    );

    [devotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("devoted"), program.programId.toBytes(), userKeypair.publicKey.toBytes()],
      program.programId
    );
  });

  it("Initializes the program state", async () => {
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          admin: admin.publicKey,
          stakeMint: stakeMint,
          state: stateAddress,
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
      const stateAccount = await program.account.stakeState.fetch(stateAddress);
      const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);
      
      console.log("\nState Account Data:");
      console.log("- Admin:", stateAccount.admin.toString());
      console.log("- Stake Mint:", stateAccount.stakeMint.toString());
      console.log("- Bump:", stateAccount.bump);

      console.log("\nTotal Devoted Account Data:");
      console.log("- Total Tokens:", totalDevotedAccount.totalTokens.toString());
      console.log("- Bump:", totalDevotedAccount.bump);
      
      // Verify the accounts were initialized correctly
      assert.ok(stateAccount.admin.equals(admin.publicKey), "Admin public key mismatch");
      assert.ok(stateAccount.stakeMint.equals(stakeMint), "Stake mint mismatch");
      assert.equal(totalDevotedAccount.totalTokens.toString(), "0", "Total tokens should be 0");
      
      console.log("Your transaction signature", tx);
      console.log("\n=== All Assertions Passed ===");
    } catch (err) {
      console.error("\n=== Error During Initialization ===");
      console.error("Error details:", err);
      throw err;
    }
  });

  it("Can devote tokens", async () => {
    const amountToDevote = new anchor.BN(600_000).mul(new anchor.BN(TOKEN_DECIMALS));

    const tx = await program.methods
      .devote(amountToDevote)
      .accounts({
        user: userKeypair.publicKey,
        state: stateAddress,
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
    assert.ok(devotedAccount.amount.eq(amountToDevote), "Wrong amount in devoted account");
    assert.equal(devotedAccount.residualDevotion.toNumber(), 0, "Initial residual devotion should be 0");
    assert.ok(devotedAccount.lastStakeTimestamp.toNumber() > 0, "Last stake timestamp should be set");

    // Verify the total devoted
    assert.ok(totalDevotedAccount.totalTokens.eq(amountToDevote), "Wrong total devoted amount");

    // Verify the vault balance
    assert.equal(
      vaultBalance.value.amount,
      amountToDevote.toString(),
      "Wrong vault balance"
    );
  });

  it("Can add to existing devotion", async () => {
    // Get initial balances and state
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(userVaultAddress);
    const initialUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const initialDevoted = await program.account.devoted.fetch(devotedAddress);
    
    console.log("\n=== Initial State ===");
    console.log("Initial vault balance:", initialVaultBalance.value.uiAmount, "tokens");
    console.log("Initial user token balance:", initialUserBalance.value.uiAmount, "tokens");
    console.log("Initial devoted amount:", initialDevoted.amount.toString(), "raw units");
    console.log("Initial devoted amount (formatted):", initialDevoted.amount.div(new anchor.BN(TOKEN_DECIMALS)).toString(), "tokens");
    console.log("Initial residual devotion:", initialDevoted.residualDevotion.toString());

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
    console.log("\nAdditional amount to devote:", additionalAmount.div(new anchor.BN(TOKEN_DECIMALS)).toString(), "tokens");

    // Get initial devotion
    const initialDevotion = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
      })
      .view();

    console.log("Initial devotion score:", initialDevotion.toString());

    const devoteTx = await program.methods
      .devote(additionalAmount)
      .accounts({
        user: userKeypair.publicKey,
        stakeState: stateAddress,  // Changed from state to stakeState
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
    console.log("Final vault balance:", finalVaultBalance.value.uiAmount, "tokens");
    console.log("Final user token balance:", finalUserBalance.value.uiAmount, "tokens");
    console.log("Final devoted amount:", finalDevotedAccount.amount.div(new anchor.BN(TOKEN_DECIMALS)).toString(), "tokens");
    console.log("Final residual devotion:", finalDevotedAccount.residualDevotion.toString());
    console.log("Total devoted in program:", finalTotalDevotedAccount.totalTokens.toString(), "raw units");

    // Verify the total amount is now the sum of both deposits
    const expectedTotal = new anchor.BN(1_000_000).mul(new anchor.BN(TOKEN_DECIMALS));
    assert.ok(finalDevotedAccount.amount.eq(expectedTotal), "Wrong total amount after second deposit");
    assert.ok(finalTotalDevotedAccount.totalTokens.eq(expectedTotal), "Wrong total devoted after second deposit");

    // Verify that residual devotion was captured
    assert.ok(
      finalDevotedAccount.residualDevotion.gt(new anchor.BN(0)),
      "Residual devotion should be greater than 0"
    );
    
    console.log("\n=== All Assertions Passed ===");
  });
});
