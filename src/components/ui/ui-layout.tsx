'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import * as React from 'react'
import {ReactNode, Suspense, useEffect, useRef, useState} from 'react'
import toast, {Toaster} from 'react-hot-toast'
import Image from 'next/image'
import { FiX, FiMenu } from 'react-icons/fi'

import {AccountChecker} from '../account/account-ui'
import {ClusterChecker, ClusterUiSelect, ExplorerLink} from '../cluster/cluster-ui'
import {WalletButton} from '../solana/solana-provider'
import { FiGithub, FiTwitter } from "react-icons/fi";
import { RiTelegramFill, RiDiscordFill, RiCoinLine, RiHeart2Fill } from "react-icons/ri";

export function UiLayout({ children, links }: { children: ReactNode; links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [isOpen, setOpen] = useState(false)

  // Define navigation items
  const navigationItems = [
    {
      title: "Devotion",
      href: "/devotion",
      icon: <RiHeart2Fill className="w-6 h-6" />,
    },
    {
      title: "Token",
      href: "https://www.defined.fi/sol/6qETqno2sYsJMz4t5gt99FJ4rJDJWB1GtvsfyLE258Jh?quoteToken=token1&cache=4cdf9",
      icon: <RiCoinLine className="w-6 h-6" />,
    },
    {
      title: "Telegram",
      href: "https://t.me/godsdotfun",
      icon: <RiTelegramFill className="w-6 h-6" />,
    },
    {
      title: "X",
      href: "https://twitter.com/godsdotfun",
      icon: <FiTwitter className="w-6 h-6" />,
    }
  ]

  return (
    
    <div className="h-full flex flex-col">
      {/* Plausible Analytics Script */}
      <script defer data-domain="gods.fun" src="https://plausible.io/js/script.js"></script>
      
      <div className="bg-base-300 text-neutral-content">
        <div className="container relative mx-auto min-h-16 flex items-center justify-between px-4">
          <Link href="/" className="font-semibold text-xl flex items-center gap-2">
            <Image
              src="/logos/logo.png"
              alt="gods.fun logo"
              width={32}
              height={32}
              className="rounded-full"
            />
            gods.fun
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navigationItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                target="_blank"
                className="hover:text-primary/80 transition-colors"
              >
                {item.icon}
              </Link>
            ))}
            <WalletButton />
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <WalletButton />
            <button
              className="p-2"
              onClick={() => setOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
            <ul className="menu menu-horizontal px-1 space-x-2">
            {links.map(({ label, path }) => (
              <li key={path}>
                <Link className={pathname.startsWith(path) ? 'active' : ''} href={path}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

          {/* Mobile Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-background border-t lg:hidden">
              <div className="container mx-auto py-4 px-4">
                <nav className="flex flex-col gap-4">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.title}
                      href={item.href}
                      target="_blank"
                      className="flex items-center gap-2 text-lg hover:text-primary/80 transition-colors"
                      onClick={() => setOpen(false)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  ))}
                <ul className="menu menu-horizontal px-1 space-x-2">
            {links.map(({ label, path }) => (
              <li key={path}>
                <Link className={pathname.startsWith(path) ? 'active' : ''} href={path}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          </nav>

        </div>
            </div>
          )}
        </div>
      </div>
      

      <div className="flex-grow mx-4 lg:mx-auto">
        <Suspense
          fallback={
            <div className="text-center my-32">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          }
        >
          {children}
        </Suspense>
        <Toaster position="bottom-right" />
      </div>
      <footer className="w-full py-20 lg:py-32 bg-foreground text-background">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Brand Section */}
                    <div className="flex flex-col gap-8">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                                gods.fun
                            </h2>
                            <p className="mt-2 text-background/80 max-w-md">
                                Interact with Divine AI Agents through token offerings and climb the celestial leaderboards.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-16 pt-8 border-t border-background/20">
                    <div className="flex flex-col md:flex-row justify-between gap-4 text-sm text-background/60">
                        {/* Social Links */}
                        <div className="flex gap-6">
                            <Link
                                href="https://discord.com/invite/ai16z"
                                target="_blank"
                                className="hover:text-background/80 transition-colors"
                            >
                                <RiDiscordFill className="w-6 h-6" />
                            </Link>
                            <Link
                                href="https://twitter.com/godsdotfun"
                                target="_blank"
                                className="hover:text-background/80 transition-colors"
                            >
                                <FiTwitter className="w-6 h-6" />
                            </Link>
                            <Link
                                href="https://t.me/godsdotfun"
                                target="_blank"
                                className="hover:text-background/80 transition-colors"
                            >
                                <RiTelegramFill className="w-6 h-6" />
                            </Link>
                            <Link
                                href="https://github.com/ai16z/eliza"
                                target="_blank"
                                className="hover:text-background/80 transition-colors"
                            >
                                <FiGithub className="w-6 h-6" />
                            </Link>
                        </div>
                        {/* Legal Links */}
                        <div className="flex gap-6">
                            <Link
                                target="_blank"
                                href="https://www.google.com/intl/en/policies/terms/"
                                className="hover:text-background transition-colors"
                            >
                                Terms of Service
                            </Link>
                            <Link
                                target="_blank"
                                href="https://www.google.com/intl/en/policies/privacy/"
                                className="hover:text-background transition-colors"
                            >
                                Privacy Policy
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    </div>
  )
}

export function AppModal({
  children,
  title,
  hide,
  show,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: ReactNode
  title: string
  hide: () => void
  show: boolean
  submit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (!dialogRef.current) return
    if (show) {
      dialogRef.current.showModal()
    } else {
      dialogRef.current.close()
    }
  }, [show, dialogRef])

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (
              <button className="btn btn-xs lg:btn-md btn-primary" onClick={submit} disabled={submitDisabled}>
                {submitLabel || 'Save'}
              </button>
            ) : null}
            <button onClick={hide} className="btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}

export function AppHero({
  children,
  title,
  subtitle,
}: {
  children?: ReactNode
  title: ReactNode
  subtitle: ReactNode
}) {
  return (
    <div className="hero py-[64px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          {typeof title === 'string' ? <h1 className="text-5xl font-bold">{title}</h1> : title}
          {typeof subtitle === 'string' ? <p className="py-6">{subtitle}</p> : subtitle}
          {children}
        </div>
      </div>
    </div>
  )
}

export function ellipsify(str = '', len = 4) {
  if (str.length > 30) {
    return str.substring(0, len) + '..' + str.substring(str.length - len, str.length)
  }
  return str
}

export function useTransactionToast() {
  return (signature: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        <ExplorerLink path={`tx/${signature}`} label={'View Transaction'} className="btn btn-xs btn-primary" />
      </div>,
    )
  }
}
