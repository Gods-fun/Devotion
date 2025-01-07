// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import DevotionIDL from '../target/idl/devotion.json'
import type { Devotion } from '../target/types/devotion'

// Re-export the generated IDL and type
export { Devotion, DevotionIDL }

// The programId is imported from the program IDL.
export const DEVOTION_PROGRAM_ID = new PublicKey(DevotionIDL.address)

// This is a helper function to get the Devotion Anchor program.
export function getDevotionProgram(provider: AnchorProvider, address?: PublicKey) {
  return new Program({ ...DevotionIDL, address: address ? address.toBase58() : DevotionIDL.address } as Devotion, provider)
}

// This is a helper function to get the program ID for the Devotion program depending on the cluster.
export function getDevotionProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Devotion program on devnet and testnet.
      return new PublicKey('GodsAfuZbVYY79KADVMe39ZwybWuL5U6RFLvyzUD5qgw')
    case 'mainnet-beta':
    default:
      return DEVOTION_PROGRAM_ID
  }
}
