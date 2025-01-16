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
import { useWallet } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

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
  const { publicKey } = useWallet()
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

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const userTokenBalance = useQuery({
    queryKey: ['user-token-balance', { cluster, publicKey, stakeMint: stateAccount.data?.stakeMint }],
    queryFn: async () => {
      if (!publicKey || !stateAccount.data?.stakeMint) return null;
      
      try {
        // Get all token accounts for this wallet
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: stateAccount.data.stakeMint
        });

        // Log for debugging
        console.log('Token accounts:', accounts);

        // If no token accounts found, try to get the associated token account
        if (accounts.value.length === 0) {
          const ata = await connection.getTokenAccountBalance(
            getAssociatedTokenAddressSync(
              stateAccount.data.stakeMint,
              publicKey
            )
          );
          return ata.value.uiAmount;
        }

        // Return the balance of the first account found
        const balance = accounts.value[0]?.account.data.parsed.info.tokenAmount.uiAmount;
        console.log('Found balance:', balance);
        return balance || 0;
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return 0;
      }
    },
    enabled: !!publicKey && !!stateAccount.data?.stakeMint,
  });

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

  const userDevotedAccount = useQuery({
    queryKey: ['devotion', 'user-account', { cluster, publicKey }],
    queryFn: async () => {
      if (!publicKey) return null;
      
      const accounts = await program.account.devoted.all([
        {
          memcmp: {
            offset: 8,
            bytes: publicKey.toBase58()
          }
        }
      ]);
      
      return accounts[0] || null;
    },
    enabled: !!publicKey,
  });

  return {
    program,
    programId,
    getProgramAccount,
    initialize,
    stateAccount,
    userDevotedAccount,
    userTokenBalance,
  }
}

export function useDevotionProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, stateAccount, userDevotedAccount, userTokenBalance } = useDevotionProgram()

  const devotionQuery = useQuery({
    queryKey: ['devotion', 'fetch', { cluster, account }],
    queryFn: () => program.account.devoted.fetch(account),
    retry: false
  })

  const devoteMutation = useMutation<string, Error, DevoteArgs>({
    mutationKey: ['devotion', 'devote', { cluster, account }],
    mutationFn: ({ amount }: DevoteArgs) => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      
      const decimals = stateAccount.data.decimals;
      const scaledAmount = new BN(amount * Math.pow(10, decimals));
      
      console.log('Devoting amount:', amount, 'Scaled amount:', scaledAmount.toString());
      
      return program.methods
        .devote(scaledAmount)
        .accounts({ stakeMint: stateAccount.data.stakeMint })
        .rpc();
    },
    onSuccess: async (tx) => {
      transactionToast(tx)
      await Promise.all([
        devotionQuery.refetch(),
        userDevotedAccount.refetch()
      ])
    },
    onError: (error) => {
      console.error('Devote error:', error);
      toast.error('Failed to devote');
    },
  })

  const waverMutation = useMutation<string, Error, WaverArgs>({
    mutationKey: ['devotion', 'waver', { cluster, account }],
    mutationFn: ({ amount }: WaverArgs) => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      
      const decimals = stateAccount.data.decimals;
      const scaledAmount = new BN(amount * Math.pow(10, decimals));
      
      console.log('Wavering amount:', amount, 'Scaled amount:', scaledAmount.toString());
      
      return program.methods
        .waver(scaledAmount)
        .accounts({ stakeMint: stateAccount.data.stakeMint })
        .rpc();
    },
    onSuccess: async (tx) => {
      transactionToast(tx)
      await Promise.all([
        devotionQuery.refetch(),
        userDevotedAccount.refetch(),
        userTokenBalance.refetch()
      ])
    },
    onError: (error) => {
      console.error('Waver error:', error);
      toast.error('Failed to waver');
    },
  })

  const heresyMutation = useMutation<string, Error>({
    mutationKey: ['devotion', 'heresy', { cluster, account }],
    mutationFn: () => {
      if (!stateAccount.data?.stakeMint) throw new Error('Stake mint not found');
      return program.methods.heresy().accounts({ stakeMint: stateAccount.data?.stakeMint }).rpc();
    },
    onSuccess: async (tx) => {
      transactionToast(tx)
      await Promise.all([
        devotionQuery.refetch(),
        userDevotedAccount.refetch()
      ])
    },
    onError: (error) => {
      console.error('Heresy error:', error)
      toast.error('Failed to commit heresy')
    }
  })

  return {
    devotionQuery,
    devoteMutation,
    waverMutation,
    heresyMutation,
  }
}
