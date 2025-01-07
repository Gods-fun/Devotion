import * as anchor from '@coral-xyz/anchor'
import {Program} from '@coral-xyz/anchor'
import {Keypair} from '@solana/web3.js'
import {Devotion} from '../target/types/devotion'

describe('devotion', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const payer = provider.wallet as anchor.Wallet

  const program = anchor.workspace.Devotion as Program<Devotion>

  const devotionKeypair = Keypair.generate()

  it('Initialize Devotion', async () => {
    await program.methods
      .initialize()
      .accounts({
        devotion: devotionKeypair.publicKey,
        payer: payer.publicKey,
      })
      .signers([devotionKeypair])
      .rpc()

    const currentCount = await program.account.devotion.fetch(devotionKeypair.publicKey)

    expect(currentCount.count).toEqual(0)
  })

  it('Increment Devotion', async () => {
    await program.methods.increment().accounts({ devotion: devotionKeypair.publicKey }).rpc()

    const currentCount = await program.account.devotion.fetch(devotionKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Increment Devotion Again', async () => {
    await program.methods.increment().accounts({ devotion: devotionKeypair.publicKey }).rpc()

    const currentCount = await program.account.devotion.fetch(devotionKeypair.publicKey)

    expect(currentCount.count).toEqual(2)
  })

  it('Decrement Devotion', async () => {
    await program.methods.decrement().accounts({ devotion: devotionKeypair.publicKey }).rpc()

    const currentCount = await program.account.devotion.fetch(devotionKeypair.publicKey)

    expect(currentCount.count).toEqual(1)
  })

  it('Set devotion value', async () => {
    await program.methods.set(42).accounts({ devotion: devotionKeypair.publicKey }).rpc()

    const currentCount = await program.account.devotion.fetch(devotionKeypair.publicKey)

    expect(currentCount.count).toEqual(42)
  })

  it('Set close the devotion account', async () => {
    await program.methods
      .close()
      .accounts({
        payer: payer.publicKey,
        devotion: devotionKeypair.publicKey,
      })
      .rpc()

    // The account should no longer exist, returning null.
    const userAccount = await program.account.devotion.fetchNullable(devotionKeypair.publicKey)
    expect(userAccount).toBeNull()
  })
})
