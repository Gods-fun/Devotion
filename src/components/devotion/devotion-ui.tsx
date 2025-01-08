'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo, useState, useEffect } from 'react'
import { ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useDevotionProgram, useDevotionProgramAccount } from './devotion-data-access'
import { useWallet } from '@solana/wallet-adapter-react'
import { BN } from '@coral-xyz/anchor'

export function DevotionCreate() {
  const { initialize, stateAccount } = useDevotionProgram()
  const { publicKey } = useWallet()
  const [interval, setInterval] = useState('')
  const [maxDevotionCharge, setMaxDevotionCharge] = useState('')
  const [mint, setMint] = useState('')

  const isFormValid = interval.length > 0 && maxDevotionCharge.length > 0 && mint.length > 0

  // If loading, show loading spinner
  if (stateAccount.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  // If program is already initialized, don't show the form
  if (stateAccount.data) {
    return (
      <div className="alert alert-info">
        <span>Program has already been initialized.</span>
      </div>
    )
  }

  if (!publicKey) {
    return <p>Connect your wallet</p>
  }

  const handleSubmit = async () => {
    try {
      await initialize.mutateAsync({
        interval: parseInt(interval),
        maxDevotionCharge: parseInt(maxDevotionCharge),
        mint,
      })
    } catch (error) {
      console.error('Failed to initialize:', error)
    }
  }

  return (
    <div className="flex flex-col gap-4 items-center">
      <input
        type="number"
        placeholder="Interval"
        value={interval}
        onChange={(e) => setInterval(e.target.value)}
        className="input input-bordered w-full max-w-xs"
      />
      <input
        type="number"
        placeholder="Max Devotion Charge"
        value={maxDevotionCharge}
        onChange={(e) => setMaxDevotionCharge(e.target.value)}
        className="input input-bordered w-full max-w-xs"
      />
      <input
        type="text"
        placeholder="Mint Public Key"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
        className="input input-bordered w-full max-w-xs"
      />
      <button
        className="btn btn-xs lg:btn-md btn-primary"
        onClick={handleSubmit}
        disabled={initialize.isPending || !isFormValid}
      >
        Create {initialize.isPending && '...'}
      </button>
    </div>
  )
}

export function DevotionList() {
  const { publicKey } = useWallet()
  const { getProgramAccount, stateAccount, userDevotedAccount } = useDevotionProgram()

  if (getProgramAccount.isLoading || userDevotedAccount.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found.</span>
      </div>
    )
  }

  if (!stateAccount.data) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program not initialized. Please initialize it first.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {publicKey ? (
        userDevotedAccount.data ? (
          <DevotionCard account={userDevotedAccount.data.publicKey} />
        ) : (
          <NewDevotionCard />
        )
      ) : (
        <div className="text-center">
          <h2 className="text-2xl">Connect Wallet</h2>
          <p>Connect your wallet to view or create devotion accounts.</p>
        </div>
      )}
    </div>
  )
}

function NewDevotionCard() {
  const [amount, setAmount] = useState('')
  const { publicKey } = useWallet()
  const { stateAccount } = useDevotionProgram()
  
  const account = useMemo(() => {
    if (!publicKey) return null
    return PublicKey.findProgramAddressSync(
      [Buffer.from("devoted"), publicKey.toBuffer()],
      stateAccount.data?.stakeMint ?? PublicKey.default
    )[0]
  }, [publicKey, stateAccount.data?.stakeMint])

  const { devoteMutation } = useDevotionProgramAccount({
    account: account ?? PublicKey.default,
  })

  if (!account) return null

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      <div className="card-body items-center text-center">
        <h2 className="card-title">Devote</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input input-bordered w-full"
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              if (amount) {
                devoteMutation.mutateAsync({ amount: parseInt(amount) })
              }
            }}
            disabled={devoteMutation.isPending || !amount}
          >
            Devote
          </button>
        </div>
      </div>
    </div>
  )
}

function DevotionScore({ devoted, stakeState }: { devoted: any; stakeState: any }) {
  const [currentDevotion, setCurrentDevotion] = useState<string>('0.00')

  useEffect(() => {
    const calculateDevotion = () => {
      if (!devoted || !stakeState) return '0.00'

      const currentTime = Math.floor(Date.now() / 1000)
      const secondsStaked = Math.max(0, currentTime - devoted.lastStakeTimestamp.toNumber())
      
      // Cap the seconds at maximum multiplier
      const cappedSeconds = Math.min(secondsStaked, stakeState.maxDevotionCharge.toNumber())
      
      // Calculate using the same logic as the Rust program
      const decimalsMultiplier = new BN(10).pow(new BN(stakeState.decimals))
      
      // Calculate current devotion
      // Formula: (cappedSeconds * amount) / (decimalsMultiplier * interval)
      const devotion = new BN(cappedSeconds)
        .mul(new BN(devoted.amount))
        .div(decimalsMultiplier)
        .div(new BN(stakeState.interval))
      
      // Calculate max devotion
      // Formula: (amount * maxDevotionCharge) / (decimalsMultiplier * interval)
      const maxDevotion = new BN(devoted.amount)
        .mul(new BN(stakeState.maxDevotionCharge))
        .div(decimalsMultiplier)
        .div(new BN(stakeState.interval))
      
      // Add residual devotion
      const totalDevotion = devotion.add(new BN(devoted.residualDevotion))
      
      // Get the minimum of total devotion and max devotion
      const finalDevotion = BN.min(totalDevotion, maxDevotion)
      
      return finalDevotion.toString()
    }

    // Update every second
    const interval = setInterval(() => {
      setCurrentDevotion(calculateDevotion())
    }, 1000)

    // Initial calculation
    setCurrentDevotion(calculateDevotion())

    return () => clearInterval(interval)
  }, [devoted, stakeState])

  return (
    <div className="stat">
      <div className="stat-title">Current Devotion</div>
      <div className="stat-value text-4xl">{currentDevotion}</div>
    </div>
  )
}

function DevotionCard({ account }: { account: PublicKey }) {
  const { devotionQuery, devoteMutation, waverMutation, heresyMutation } = useDevotionProgramAccount({
    account,
  })
  const { stateAccount } = useDevotionProgram()
  const [devoteAmount, setDevoteAmount] = useState('')
  const [waverAmount, setWaverAmount] = useState('')

  if (devotionQuery.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (devotionQuery.isError || !devotionQuery.data) {
    return null;
  }

  const decimals = stateAccount.data?.decimals ?? 0
  const displayAmount = (amount: BN | number) => {
    const numberAmount = amount instanceof BN ? amount.toNumber() : amount
    return (numberAmount / Math.pow(10, decimals)).toFixed(2)
  }

  const handleHeresy = async () => {
    try {
      await heresyMutation.mutateAsync()
    } catch (error) {
      console.error('Heresy error:', error)
    }
  }

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      <div className="card-body items-center text-center">
        <h2 className="card-title">Your Devotion</h2>
        
        <div className="stats stats-vertical shadow">
          <DevotionScore 
            devoted={devotionQuery.data} 
            stakeState={stateAccount.data} 
          />
          <div className="stat">
            <div className="stat-title">Devoted Amount</div>
            <div className="stat-value">{displayAmount(devotionQuery.data.amount)}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          {/* Devote more tokens */}
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              placeholder="Amount"
              value={devoteAmount}
              onChange={(e) => setDevoteAmount(e.target.value)}
              className="input input-bordered w-full"
            />
            <button
              className="btn btn-primary"
              onClick={() => devoteMutation.mutateAsync({ amount: parseFloat(devoteAmount) })}
              disabled={devoteMutation.isPending || !devoteAmount}
            >
              Devote More
            </button>
          </div>

          {/* Waver (unstake) tokens */}
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              placeholder="Amount"
              value={waverAmount}
              onChange={(e) => setWaverAmount(e.target.value)}
              className="input input-bordered w-full"
            />
            <button
              className="btn btn-secondary"
              onClick={() => waverMutation.mutateAsync({ amount: parseFloat(waverAmount) })}
              disabled={waverMutation.isPending || !waverAmount}
            >
              Waver
            </button>
          </div>

          {/* Heresy (close account) */}
          <button
            className="btn btn-error"
            onClick={handleHeresy}
            disabled={heresyMutation.isPending}
          >
            {heresyMutation.isPending ? 'Processing...' : 'Commit Heresy'}
          </button>
        </div>

        <div className="text-sm opacity-50">
          <ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} />
        </div>
      </div>
    </div>
  )
}
