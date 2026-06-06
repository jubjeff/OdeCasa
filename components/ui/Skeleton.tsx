import { HTMLAttributes } from 'react'

/** Bloco cinza pulsante para loading. Combine vários para formar o esqueleto de um card. */
export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={['animate-pulse rounded-md bg-line/70', className].join(' ')}
      {...props}
    />
  )
}
