'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useDevotionProgram, useDevotionProgramAccount } from './devotion-data-access'
import { useWallet } from '@solana/wallet-adapter-react'

export function DevotionCreate() {
  const { initialize } = useDevotionProgram()
  const { publicKey } = useWallet()
  const [interval, setInterval] = useState('')
  const [maxDevotionCharge, setMaxDevotionCharge] = useState('')
  const [mint, setMint] = useState('')

  const isFormValid = interval.length > 0 && maxDevotionCharge.length > 0 && mint.length > 0

  const handleSubmit = () => {
    if (isFormValid) {
      initialize.mutateAsync({
        interval: parseInt(interval),
        maxDevotionCharge: parseInt(maxDevotionCharge),
        mint: mint,
      })
    }
  }

  if (!publicKey) {
    return <p>Connect your wallet</p>
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
  const { getProgramAccount, stateAccount, devotedAccounts } = useDevotionProgram()

  if (getProgramAccount.isLoading || devotedAccounts.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
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

  // Find user's devoted account if it exists
  const userDevotedAccount = publicKey 
    ? devotedAccounts.data?.find(account => 
        account.account.user.toString() === publicKey.toString()
      )
    : null;

  return (
    <div className="space-y-6">
      <TotalDevotedCard />
      {publicKey ? (
        userDevotedAccount ? (
          // User has a devoted account - show their stats and actions
          <DevotionCard account={userDevotedAccount.publicKey} />
        ) : (
          // User doesn't have a devoted account - show devote form
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
        <h2 className="card-title">Start Your Devotion</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Amount to devote"
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

function TotalDevotedCard() {
  const { totalDevotedAccount } = useDevotionProgram()

  if (totalDevotedAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      <div className="card-body items-center text-center">
        <h2 className="card-title">Total Tokens Devoted</h2>
        <p className="text-3xl">{totalDevotedAccount.data?.totalTokens.toString() ?? '0'}</p>
      </div>
    </div>
  )
}

function DevotionCard({ account }: { account: PublicKey }) {
  const { devotionQuery, devoteMutation, waverMutation, heresyMutation } = useDevotionProgramAccount({
    account,
  })
  const [devoteAmount, setDevoteAmount] = useState('')
  const [waverAmount, setWaverAmount] = useState('')

  if (devotionQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  if (!devotionQuery.data) return null

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      <div className="card-body items-center text-center">
        <h2 className="card-title">Your Devotion</h2>
        
        <div className="stats stats-vertical shadow">
          <div className="stat">
            <div className="stat-title">Devoted Amount</div>
            <div className="stat-value">{devotionQuery.data.amount.toString()}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Residual Devotion</div>
            <div className="stat-value">{devotionQuery.data.residualDevotion.toString()}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          {/* Devote more tokens */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={devoteAmount}
              onChange={(e) => setDevoteAmount(e.target.value)}
              className="input input-bordered w-full"
            />
            <button
              className="btn btn-primary"
              onClick={() => devoteMutation.mutateAsync({ amount: parseInt(devoteAmount) })}
              disabled={devoteMutation.isPending || !devoteAmount}
            >
              Devote More
            </button>
          </div>

          {/* Waver (unstake) tokens */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={waverAmount}
              onChange={(e) => setWaverAmount(e.target.value)}
              className="input input-bordered w-full"
            />
            <button
              className="btn btn-secondary"
              onClick={() => waverMutation.mutateAsync({ amount: parseInt(waverAmount) })}
              disabled={waverMutation.isPending || !waverAmount}
            >
              Waver
            </button>
          </div>

          {/* Heresy (close account) */}
          <button
            className="btn btn-error"
            onClick={() => heresyMutation.mutateAsync()}
            disabled={heresyMutation.isPending}
          >
            Commit Heresy
          </button>
        </div>

        <div className="text-sm opacity-50">
          <ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} />
        </div>
      </div>
    </div>
  )
}
