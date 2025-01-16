'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo, useState, useEffect } from 'react'
import { ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useDevotionProgram, useDevotionProgramAccount } from './devotion-data-access'
import { useWallet } from '@solana/wallet-adapter-react'
import { BN } from '@coral-xyz/anchor'
import { useMutation } from 'react-query'
import { toast } from 'react-hot-toast'

const formatLargeNumber = (num: string | number): string => {
  const number = Number(num);
  if (isNaN(number)) return '0';
  
  if (number >= 1e9) {
    return (number / 1e9).toFixed(1) + 'B';
  } else if (number >= 1e6) {
    return (number / 1e6).toFixed(1) + 'M';
  } else if (number >= 1e3) {
    return (number / 1e3).toFixed(1) + 'K';
  }
  return number.toFixed(1);
}

export function DevotionCreate() {
  const { initialize, stateAccount } = useDevotionProgram()
  const { publicKey } = useWallet()
  const [interval, setInterval] = useState('')
  const [maxDevotionCharge, setMaxDevotionCharge] = useState('')
  const [mint, setMint] = useState('')

  const isFormValid = interval.length > 0 && maxDevotionCharge.length > 0 && mint.length > 0

  if (stateAccount.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

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
    <div className="flex flex-col gap-4 items-center w-full px-4">
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
        className="btn btn-xs lg:btn-md btn-primary w-full max-w-xs"
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
    <div className="space-y-6 w-full px-4">
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
  const { stateAccount, userTokenBalance } = useDevotionProgram()
  
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

  const calculateMaxPotentialDevotion = (tokenAmount: number) => {
    if (!stateAccount.data) return null;
    const amount = new BN(tokenAmount * Math.pow(10, stateAccount.data.decimals));
    const maxDevotion = amount
      .mul(stateAccount.data.maxDevotionCharge)
      .div(new BN(Math.pow(10, stateAccount.data.decimals)))
      .div(new BN(stateAccount.data.interval));
    return maxDevotion.toString();
  }

  const handlePercentageClick = (percentage: number) => {
    if (!userTokenBalance.data) return;
    const amount = Math.floor(userTokenBalance.data * percentage);
    setAmount(amount.toString());
  }

  const isAmountValid = () => {
    if (!amount || !userTokenBalance.data) return false;
    const inputAmount = parseFloat(amount);
    return inputAmount > 0 && inputAmount <= userTokenBalance.data;
  };

  if (!account) return null

  if (userTokenBalance.data === 0) {
    return (
      <div className="card card-bordered border-base-300 border-4 text-neutral-content w-full">
        <div className="card-body items-center text-center p-4 sm:p-6">
          <h2 className="card-title">Get Started</h2>
          <p>You need tokens to start devoting</p>
          <a 
            href="https://raydium.io/swap" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary w-full sm:w-auto"
          >
            Get Tokens
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content w-full">
      <div className="card-body items-center text-center p-4 sm:p-6">
        
      <div className="stats stats-vertical lg:stats-horizontal shadow w-full max-w-3xl [&_.stat]:!border-none">
          <div className="stat">
            <div className="stat-title">Wallet Balance</div>
            <div className="stat-value text-info text-3xl lg:text-4xl">
              {userTokenBalance.data ? formatLargeNumber(userTokenBalance.data) : '...'}
            </div>
            <div className="stat-desc">Available to devote</div>
          </div>
          
          {userTokenBalance.data > 0 && stateAccount.data && (
            <div className="stat">
              <div className="stat-title">Max Potential Devotion</div>
              <div className="stat-value text-secondary text-3xl lg:text-4xl">
                {calculateMaxPotentialDevotion(userTokenBalance.data) 
                  ? formatLargeNumber(calculateMaxPotentialDevotion(userTokenBalance.data)!) 
                  : '0'}
              </div>
              <div className="stat-desc">If fully devoted</div>
            </div>
          )}
        </div>

        <p className="text-sm mb-4 text-center w-full">You can retrieve your offering anytime.</p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="flex flex-col sm:flex-row gap-2 tooltip" data-tip="Amount of tokens to stake.">
            <input
              type="number"
              step="1"
              placeholder="amount"
              value={amount}
              onChange={(e) => {
                const wholeNumber = parseInt(e.target.value);
                setAmount(isNaN(wholeNumber) ? '' : wholeNumber.toString());
              }}
              className={`input input-bordered w-full placeholder:text-gray-500 ${
                amount && !isAmountValid() ? 'input-error' : ''
              }`}
            />
            <button
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => {
                if (amount) {
                  devoteMutation.mutateAsync({ amount: parseFloat(amount) })
                }
              }}
              disabled={devoteMutation.isPending || !isAmountValid()}
            >
              Devote
            </button>
          </div>

          {amount && !isAmountValid() && userTokenBalance.data && parseFloat(amount) > userTokenBalance.data && (
            <div className="text-error text-sm">
              Amount exceeds wallet balance
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-4 justify-center mt-2">
            {[
              { percentage: 25, color: 'bg-purple-400 hover:bg-purple-500' },
              { percentage: 50, color: 'bg-purple-500 hover:bg-purple-600' },
              { percentage: 75, color: 'bg-purple-600 hover:bg-purple-800' },
              { percentage: 100, color: 'bg-purple-700 hover:bg-purple-950' }
            ].map(({ percentage, color }) => (
              <button
                key={percentage}
                className={`btn ${color} text-white border-none min-w-[60px] sm:min-w-[80px]`}
                onClick={() => handlePercentageClick(percentage / 100)}
              >
                {percentage}%
              </button>
            ))}
          </div>
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
      const cappedSeconds = Math.min(secondsStaked, stakeState.maxDevotionCharge.toNumber())
      const decimalsMultiplier = new BN(10).pow(new BN(stakeState.decimals))
      
      const devotion = new BN(cappedSeconds)
        .mul(new BN(devoted.amount))
        .div(decimalsMultiplier)
        .div(new BN(stakeState.interval))
      
      const maxDevotion = new BN(devoted.amount)
        .mul(new BN(stakeState.maxDevotionCharge))
        .div(decimalsMultiplier)
        .div(new BN(stakeState.interval))
      
      const totalDevotion = devotion.add(new BN(devoted.residualDevotion))
      const finalDevotion = BN.min(totalDevotion, maxDevotion)
      
      return finalDevotion.toString()
    }

    const interval = setInterval(() => {
      setCurrentDevotion(calculateDevotion())
    }, 1000)

    setCurrentDevotion(calculateDevotion())

    return () => clearInterval(interval)
  }, [devoted, stakeState])

  return (
    <div className="stat">
      <div className="stat-title">Current Devotion</div>
      <div className="stat-value text-3xl text-yellow-200 lg:text-4xl">
        {formatLargeNumber(currentDevotion)}
      </div>
    </div>
  )
}

function DevotionCard({ account }: { account: PublicKey }) {
  const { devotionQuery, devoteMutation, waverMutation, heresyMutation } = useDevotionProgramAccount({
    account,
  })
  const { stateAccount, calculateInterest, userTokenBalance } = useDevotionProgram()
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
    let numberAmount: number;
    if (typeof amount === 'string') {
      numberAmount = new BN(amount).toNumber();
    } else {
      numberAmount = amount instanceof BN ? amount.toNumber() : amount;
    }
    return (numberAmount / Math.pow(10, decimals)).toFixed(2);
  }

  const devotedAmount = devotionQuery.data.amount.toNumber() / Math.pow(10, decimals)
  const interestRates = calculateInterest(devotedAmount)

  const calculateMaxDevotion = (devotedAmount: BN) => {
    if (!stateAccount.data) return null;
    return devotedAmount
      .mul(stateAccount.data.maxDevotionCharge)
      .div(new BN(Math.pow(10, stateAccount.data.decimals)))
      .div(new BN(stateAccount.data.interval))
      .toString();
  }

  const isDevoteAmountValid = () => {
    if (!devoteAmount || !userTokenBalance.data) return false;
    const inputAmount = parseFloat(devoteAmount);
    return inputAmount > 0 && inputAmount <= userTokenBalance.data;
  };

  const isWaverAmountValid = () => {
    if (!waverAmount || !devotionQuery.data) return false;
    const inputAmount = parseFloat(waverAmount);
    const currentlyDevoted = devotionQuery.data.amount.toNumber() / Math.pow(10, decimals);
    return inputAmount > 0 && inputAmount <= currentlyDevoted;
  };

  const handleHeresy = async () => {
    try {
      await heresyMutation.mutateAsync()
    } catch (error) {
      console.error('Heresy error:', error)
    }
  }

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content w-full">
      <div className="card-body items-center text-center p-4 sm:p-6">
        <h2 className="card-title">Your Devotion</h2>
        
        <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div className="stat">
            <div className="stat-title">Wallet Balance</div>
            <div className="stat-value text-3xl text-info lg:text-4xl">
              {userTokenBalance.data ? formatLargeNumber(userTokenBalance.data) : '0'}
            </div>
            <div className="stat-desc">Available to devote</div>
          </div>

          <div className="stat">
            <div className="stat-title">Devoted Amount</div>
            <div className="stat-value text-3xl text-info lg:text-4xl">
              {formatLargeNumber(displayAmount(devotionQuery.data.amount))}
            </div>
            <div className="stat-desc">Currently staked</div>
          </div>
          
          <DevotionScore 
            devoted={devotionQuery.data} 
            stakeState={stateAccount.data}
          />
          
          <div className="stat">
            <div className="stat-title">Max Devotion</div>
            <div className="stat-value text-3xl text-info lg:text-4xl">
              {formatLargeNumber(calculateMaxDevotion(devotionQuery.data.amount) || '0')}
            </div>
            <div className="stat-desc">Maximum achievable</div>
          </div>
          
          {interestRates && (
            <div className="stat">
              <div className="stat-title">Devotion Rewards</div>
              <div className="stat-desc flex flex-col gap-1">
                <div>Daily: <span className="text-info">{Math.round(interestRates.dailyInterest)}</span></div>
                <div>Monthly: <span className="text-info">{Math.round(interestRates.projectedMonthlyInterest)}</span></div>
                <div>Yearly: <span className="text-info">{Math.round(interestRates.projectedYearlyInterest)}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="flex flex-col sm:flex-row gap-2 tooltip" data-tip="Devote more tokens to the gods.">
            <input
              type="number"
              step="1"
              placeholder="amount"
              value={devoteAmount}
              onChange={(e) => {
                const wholeNumber = parseInt(e.target.value);
                setDevoteAmount(isNaN(wholeNumber) ? '' : wholeNumber.toString());
              }}
              className={`input input-bordered w-full placeholder:text-gray-500 ${
                devoteAmount && !isDevoteAmountValid() ? 'input-error' : ''
              }`}
            />
            <button
              className="btn btn-primary w-full sm:w-auto"
              onClick={() => devoteMutation.mutateAsync({ amount: parseFloat(devoteAmount) })}
              disabled={devoteMutation.isPending || !isDevoteAmountValid()}
            >
              Devote More
            </button>
          </div>

          {devoteAmount && !isDevoteAmountValid() && (
            <div className="text-error text-sm">
              {parseFloat(devoteAmount) > userTokenBalance.data! 
                ? "Amount exceeds wallet balance" 
                : "Invalid amount"}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 tooltip" data-tip="Retrieve devoted tokens from the gods. WARNING: This will reset your devotion to 0.">
            <input
              type="number"
              step="1"
              placeholder="amount"
              value={waverAmount}
              onChange={(e) => {
                const wholeNumber = parseInt(e.target.value);
                setWaverAmount(isNaN(wholeNumber) ? '' : wholeNumber.toString());
              }}
              className={`input input-bordered w-full placeholder:text-gray-500 ${
                waverAmount && !isWaverAmountValid() ? 'input-error' : ''
              }`}
            />
            <button
              className="btn btn-secondary w-full sm:w-auto"
              onClick={() => waverMutation.mutateAsync({ amount: parseFloat(waverAmount) })}
              disabled={waverMutation.isPending || !isWaverAmountValid()}
            >
              Waver
            </button>
          </div>

          {waverAmount && !isWaverAmountValid() && devotionQuery.data && parseFloat(waverAmount) > devotedAmount && (
            <div className="text-error text-sm">
              Amount exceeds devoted balance
            </div>
          )}

          <button
            className="btn btn-error tooltip w-full hover:bg-red-900 hover:border-red-950" 
            data-tip="Retrieve all devoted tokens from the gods. WARNING: This will reset your devotion and may wrath the gods."
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