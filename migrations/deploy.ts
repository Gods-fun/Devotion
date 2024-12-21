// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Devotion } from "../target/types/devotion";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint } from "@solana/spl-token";

module.exports = async function (provider: anchor.Provider) {
  // Configure client to use the provider
  anchor.setProvider(provider);

  // Get program from workspace
  const program = anchor.workspace.Devotion as Program<Devotion>;
  console.log("Program ID:", program.programId.toString());

  try {
    // Generate admin keypair
    const admin = Keypair.generate();
    console.log("Admin Public Key:", admin.publicKey.toString());

    // Airdrop SOL to admin
    const signature = await provider.connection.requestAirdrop(
      admin.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    console.log("Airdropped 2 SOL to admin");

    // Create stake mint
    const stakeMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9 // decimals
    );
    console.log("Stake mint created:", stakeMint.toString());

    // Derive PDAs
    const [stateAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), program.programId.toBytes()],
      program.programId
    );
    console.log("State PDA:", stateAddress.toString());

    const [totalDevotedAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("total_devoted"), program.programId.toBytes()],
      program.programId
    );
    console.log("Total Devoted PDA:", totalDevotedAddress.toString());

    // Initialize program state
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

    console.log("Program initialized successfully!");
    console.log("Transaction signature:", tx);

    // Fetch and verify the created accounts
    const stateAccount = await program.account.stakeState.fetch(stateAddress);
    const totalDevotedAccount = await program.account.totalDevoted.fetch(totalDevotedAddress);

    console.log("\nDeployment State:");
    console.log("State Account:");
    console.log("- Admin:", stateAccount.admin.toString());
    console.log("- Stake Mint:", stateAccount.stakeMint.toString());
    console.log("- Bump:", stateAccount.bump);

    console.log("\nTotal Devoted Account:");
    console.log("- Total Tokens:", totalDevotedAccount.totalTokens.toString());
    console.log("- Bump:", totalDevotedAccount.bump);

    // Save important addresses for future reference
    const deploymentInfo = {
      programId: program.programId.toString(),
      admin: admin.publicKey.toString(),
      stakeMint: stakeMint.toString(),
      state: stateAddress.toString(),
      totalDevoted: totalDevotedAddress.toString(),
    };

    console.log("\nDeployment Info:", deploymentInfo);
    // You might want to write this to a file
    // fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
};
