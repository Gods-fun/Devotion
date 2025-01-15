'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { WalletButton } from '../solana/solana-provider'
import { ClusterUiSelect } from '../cluster/cluster-ui'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useCallback } from 'react'

export function useTransactionToast() {
  const { getExplorerUrl } = useCluster()

  return useCallback(
    (signature: string) => {
      toast.success(
        <div>
          <div>Transaction confirmed</div>
          <a
            href={getExplorerUrl(`tx/${signature}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary text-sm"
          >
            View Transaction
          </a>
        </div>
      )
    },
    [getExplorerUrl]
  )
}

export function AppHero({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="hero py-8 px-4 sm:py-[64px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-5xl font-bold">{title}</h1>
          {subtitle ? <p className="py-4 sm:py-6 text-sm sm:text-base">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </div>
  )
}

export function AppModal({
  children,
  show,
  hide,
  title,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: React.ReactNode
  show: boolean
  hide: () => void
  title: string
  submit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
}) {
  return show ? (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-md mx-auto">
        <h3 className="font-bold text-lg">{title}</h3>
        <div className="py-4 space-y-4">{children}</div>
        <div className="modal-action flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm sm:btn-md" onClick={hide}>
            Close
          </button>
          {submit ? (
            <button className="btn btn-primary btn-sm sm:btn-md" disabled={submitDisabled} onClick={submit}>
              {submitLabel || 'Save'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null
}

export function UiLayout({ children, links }: { children: React.ReactNode; links?: { label: string; path: string }[] }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col min-h-screen">
      <div className="navbar bg-base-300 px-4 pr-2 sm:px-8 md:px-8 min-h-[4rem]">
        <div className="flex-1">
          <Link href="/" className="text-lg sm:text-xl font-bold">
            Gods
          </Link>
        </div>

        {/* Navigation links - will collapse into a menu on mobile */}
        <div className="hidden md:flex md:flex-none md:gap-2 md:mx-4">
          {links?.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`btn btn-sm ${pathname === link.path ? 'btn-primary' : 'btn-ghost'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Cluster selector and wallet button */}
        <div className="flex flex-none gap-1 sm:gap-2">
          <WalletButton />
        </div>

        {/* Mobile menu */}
        {links?.length ? (
          <div className="dropdown dropdown-end md:hidden ml-1 sm:ml-2">
            <label tabIndex={0} className="btn btn-ghost btn-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </label>
            <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2">
              {links.map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className={`text-sm ${pathname === link.path ? 'active' : ''}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <main className="flex-1 bg-base-100">{children}</main>
    </div>
  )
}

export function ellipsify(str = '', len = 4) {
  if (str.length > 30) {
    return str.substring(0, len) + '..' + str.substring(str.length - len)
  }
  return str
}