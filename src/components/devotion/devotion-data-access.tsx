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

export function useDevotionProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getDevotionProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getDevotionProgram(provider, programId), [provider, programId])

  const accounts = useQuery({
    queryKey: ['devotion', 'all', { cluster }],
    queryFn: () => program.account.devotion.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initialize = useMutation({
    mutationKey: ['devotion', 'initialize', { cluster }],
    mutationFn: (keypair: Keypair) =>
      program.methods.initialize().accounts({ devotion: keypair.publicKey }).signers([keypair]).rpc(),
    onSuccess: (signature) => {
      transactionToast(signature)
      return accounts.refetch()
    },
    onError: () => toast.error('Failed to initialize account'),
  })

  return {
    program,
    programId,
    accounts,
    getProgramAccount,
    initialize,
  }
}

export function useDevotionProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts } = useDevotionProgram()

  const accountQuery = useQuery({
    queryKey: ['devotion', 'fetch', { cluster, account }],
    queryFn: () => program.account.devotion.fetch(account),
  })

  const closeMutation = useMutation({
    mutationKey: ['devotion', 'close', { cluster, account }],
    mutationFn: () => program.methods.close().accounts({ devotion: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accounts.refetch()
    },
  })

  const decrementMutation = useMutation({
    mutationKey: ['devotion', 'decrement', { cluster, account }],
    mutationFn: () => program.methods.decrement().accounts({ devotion: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const incrementMutation = useMutation({
    mutationKey: ['devotion', 'increment', { cluster, account }],
    mutationFn: () => program.methods.increment().accounts({ devotion: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  const setMutation = useMutation({
    mutationKey: ['devotion', 'set', { cluster, account }],
    mutationFn: (value: number) => program.methods.set(value).accounts({ devotion: account }).rpc(),
    onSuccess: (tx) => {
      transactionToast(tx)
      return accountQuery.refetch()
    },
  })

  return {
    accountQuery,
    closeMutation,
    decrementMutation,
    incrementMutation,
    setMutation,
  }
}
