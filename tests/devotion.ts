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
    // Airdrop SOL to admin
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    
    // Create stake mint
    stakeMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9 // decimals
    );
    
    // Derive PDAs
    [stateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), program.programId.toBytes()],
      program.programId
    );
    
    [totalDevotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("total_devoted"), program.programId.toBytes()],
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
      
      // Fetch the created accounts
      const stateAccount = await program.account.stakeState.fetch(stateAddress);
      const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);
      
      // Verify the accounts were initialized correctly
      assert.ok(stateAccount.admin.equals(admin.publicKey));
      assert.ok(stateAccount.stakeMint.equals(stakeMint));
      assert.equal(totalDevotedAccount.totalTokens.toString(), "0");
      
      console.log("Your transaction signature", tx);
    } catch (err) {
      console.error("Error:", err);
      throw err;
    }
  });
});
