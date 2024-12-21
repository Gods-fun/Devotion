import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Devotion } from "../target/types/devotion";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";
import { assert } from "chai";

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
});
