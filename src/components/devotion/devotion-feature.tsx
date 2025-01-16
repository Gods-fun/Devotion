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
          'Devote your tokens to the Gods by staking. Your devotion grows over time. Waver in your devotion to the gods or commit heresy in order to get your tokens back.'
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
