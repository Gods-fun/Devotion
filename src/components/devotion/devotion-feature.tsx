'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { AppHero } from '../ui/ui-layout'
import { useDevotionProgram } from './devotion-data-access'
import { DevotionCreate, DevotionList } from './devotion-ui'

export default function DevotionFeature() {
  const { publicKey } = useWallet()

  return publicKey ? (
    <div>
      <AppHero
        title="Devotion"
        subtitle={
          'Devote your tokens to the Gods by staking. Your devotion grows over time. Waver in your devotion to the gods or commit heresy in order to get your tokens back.'
        }
      >
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
