'use client'

import { getDevotionProgram, getDevotionProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'
import { BN } from '@coral-xyz/anchor'

interface InitializeArgs {
  interval: number
  maxDevotionCharge: number
  mint: string
}

interface DevoteArgs {
  amount: number
}

interface WaverArgs {
  amount: number
}

export function useDevotionProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getDevotionProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getDevotionProgram(provider, programId), [provider, programId])

  const stateAccount = useQuery({
    queryKey: ['devotion', 'state', { cluster }],
    queryFn: () => program.account.stakeState.fetch(
      PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        programId
      )[0]
    ),
  })

  const totalDevotedAccount = useQuery({
    queryKey: ['devotion', 'total-devoted', { cluster }],
    queryFn: () => program.account.totalDevoted.fetch(
      PublicKey.findProgramAddressSync(
        [Buffer.from("total-devoted")],
        programId
      )[0]
    ),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initialize = useMutation<string, Error, InitializeArgs>({
    mutationKey: ['devotion', 'initialize', { cluster }],
    mutationFn: ({ interval, maxDevotionCharge, mint }: InitializeArgs) =>
      program.methods
        .initialize(new BN(interval), new BN(maxDevotionCharge))
        .accounts({ stakeMint: new PublicKey(mint) })
        .rpc(),
    onSuccess: (signature) => {
      transactionToast(signature)
      return stateAccount.refetch()
    },
    onError: () => toast.error('Failed to initialize account'),
  })

  return {
    program,
    programId,
    getProgramAccount,
    initialize,
    stateAccount,
    totalDevotedAccount,
  }
}

export function useDevotionProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, stateAccount, totalDevotedAccount } = useDevotionProgram()

  const accountQuery = useQuery({
    queryKey: ['devotion', 'fetch', { cluster, account }],
    queryFn: () => program.account.devoted.fetch(account),
  })

  const devoteMutation = useMutation<string, Error, DevoteArgs>({
    mutationKey: ['devotion', 'devote', { cluster, account }],
    mutationFn: ({ amount }: DevoteArgs) => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      return program.methods
        .devote(new BN(amount))
        .accounts({ stakeMint: stateAccount.data.stakeMint })
        .rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
    onError: () => toast.error('Failed to devote'),
  })

  const waverMutation = useMutation<string, Error, WaverArgs>({
    mutationKey: ['devotion', 'waver', { cluster, account }],
    mutationFn: ({ amount }: WaverArgs) => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      return program.methods
        .waver(new BN(amount))
        .accounts({ stakeMint: stateAccount.data.stakeMint })
        .rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const heresyMutation = useMutation<string, Error>({
    mutationKey: ['devotion', 'heresy', { cluster, account }],
    mutationFn: () => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      return program.methods.heresy().accounts({ stakeMint: stateAccount.data?.stakeMint }).rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  return {
    accountQuery,
    devoteMutation,
    waverMutation,
    heresyMutation,
  }
}
