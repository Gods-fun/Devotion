import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Devotion } from "../target/types/devotion";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddress, createAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

const TOKEN_DECIMALS = 1_000_000_000; // 10^9

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

    // Mint some tokens to user
    await mintTo(
      provider.connection,
      admin,
      stakeMint,
      userTokenAccount,
      admin,
      1000 * TOKEN_DECIMALS
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
          stakeState: stateAddress,
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
    const amountToDevote = new anchor.BN(100 * TOKEN_DECIMALS);

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
    assert.ok(devotedAccount.lastStakeTimestamp > 0, "Last stake timestamp should be set");

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
    // Get initial slot and timestamp
    let slot = await provider.connection.getSlot();
    let initialTimestamp = (await provider.connection.getBlockTime(slot)) as number;
    console.log("\nInitial timestamp:", new Date(initialTimestamp * 1000).toISOString());

    // Create a transaction with multiple instructions to advance the clock
    const advanceClockTx = new anchor.web3.Transaction();
    for (let i = 0; i < 10; i++) {
      advanceClockTx.add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: userKeypair.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL / 100,
        })
      );
    }

    // Send and confirm the transaction
    const clockTx = await provider.sendAndConfirm(advanceClockTx, [admin]);
    console.log("Clock advance transaction signature:", clockTx);

    // Get new timestamp
    slot = await provider.connection.getSlot();
    const newTimestamp = (await provider.connection.getBlockTime(slot)) as number;
    console.log("New timestamp:", new Date(newTimestamp * 1000).toISOString());
    console.log("Time difference:", (newTimestamp - initialTimestamp), "seconds");

    // Add a small delay to ensure the clock has advanced
    await new Promise(resolve => setTimeout(resolve, 1000));

    const additionalAmount = new anchor.BN(50 * TOKEN_DECIMALS);

    // Get initial devotion
    const initialDevotion = await program.methods
      .checkDevotion()
      .accounts({
        devoted: devotedAddress,
      })
      .view();

    console.log("Initial devotion:", initialDevotion.toString());

    const devoteTx = await program.methods
      .devote(additionalAmount)
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

    console.log("Additional devote transaction signature:", devoteTx);

    // Fetch and verify the accounts
    const devotedAccount = await program.account.devoted.fetch(devotedAddress);
    const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);

    // Verify the total amount is now the sum of both deposits
    const expectedTotal = new anchor.BN(150 * TOKEN_DECIMALS);
    assert.ok(devotedAccount.amount.eq(expectedTotal), "Wrong total amount after second deposit");
    assert.ok(totalDevotedAccount.totalTokens.eq(expectedTotal), "Wrong total devoted after second deposit");

    // Verify that residual devotion was captured
    assert.ok(
      devotedAccount.residualDevotion.gt(new anchor.BN(0)),
      "Residual devotion should be greater than 0"
    );
  });
});
