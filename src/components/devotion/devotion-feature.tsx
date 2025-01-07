'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { AppHero, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useDevotionProgram } from './devotion-data-access'
import { DevotionCreate, DevotionList } from './devotion-ui'

export default function DevotionFeature() {
  const { publicKey } = useWallet()
  const { programId } = useDevotionProgram()

  return publicKey ? (
    <div>
      <AppHero
        title="Devotion"
        subtitle={
          'Initialize the devotion program by inputting your interval, max devotion charge and token.  Devote new tokens, waver in your devotion to the gods or commit heresy.'
        }
      >
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <DevotionCreate />
      </AppHero>
      <DevotionList />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
