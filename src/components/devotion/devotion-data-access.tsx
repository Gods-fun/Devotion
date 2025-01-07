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

const STAKE_MINT = new PublicKey('GZnHRJqhDAymatpB7TjgyEy7AW59rW9rgpbkxa4tysgS')

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
    mutationFn: ({ interval, maxDevotionCharge }: InitializeArgs) =>
      program.methods
        .initialize(new BN(interval), new BN(maxDevotionCharge))
        .accounts({ stakeMint: STAKE_MINT })
        .rpc(),
    onSuccess: (signature) => {
      transactionToast(signature)
      return stateAccount.refetch()
    },
    onError: () => toast.error('Failed to initialize account'),
  })

  const devotedAccounts = useQuery({
    queryKey: ['devotion', 'accounts', { cluster }],
    queryFn: async () => {
      const accounts = await program.account.devoted.all();
      return accounts;
    },
  });

  return {
    program,
    programId,
    getProgramAccount,
    initialize,
    stateAccount,
    totalDevotedAccount,
    devotedAccounts,
  }
}

export function useDevotionProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, stateAccount } = useDevotionProgram()

  const devotionQuery = useQuery({
    queryKey: ['devotion', 'fetch', { cluster, account }],
    queryFn: () => program.account.devoted.fetch(account),
  })

  const devoteMutation = useMutation<string, Error, DevoteArgs>({
    mutationKey: ['devotion', 'devote', { cluster, account }],
    mutationFn: ({ amount }: DevoteArgs) => {
      return program.methods
        .devote(new BN(amount))
        .accounts({ stakeMint: STAKE_MINT })
        .rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return devotionQuery.refetch()
    },
    onError: () => toast.error('Failed to devote'),
  })

  const waverMutation = useMutation<string, Error, WaverArgs>({
    mutationKey: ['devotion', 'waver', { cluster, account }],
    mutationFn: ({ amount }: WaverArgs) => {
      return program.methods
        .waver(new BN(amount))
        .accounts({ stakeMint: STAKE_MINT })
        .rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return devotionQuery.refetch()
    },
  })

  const heresyMutation = useMutation<string, Error>({
    mutationKey: ['devotion', 'heresy', { cluster, account }],
    mutationFn: () => {
      return program.methods.heresy().accounts({ stakeMint: STAKE_MINT }).rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return devotionQuery.refetch()
    },
  })

  return {
    devotionQuery,
    devoteMutation,
    waverMutation,
    heresyMutation,
  }
}
