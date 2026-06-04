import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** URL da imagem de produto (proporção 4:3). Omita para usar o Card como container genérico. */
  image?: string
  imageAlt?: string
  name?: string
  price?: string
  unit?: string
  /** Classe CSS aplicada à área de conteúdo. Padrão: "p-4". */
  bodyClassName?: string
}

export function Card({
  image,
  imageAlt = '',
  name,
  price,
  unit,
  children,
  className = '',
  bodyClassName = 'p-4',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'bg-surface rounded-lg overflow-hidden',
        'shadow-sm hover:shadow-md',
        'transition-shadow duration-200',
        className,
      ].join(' ')}
      {...props}
    >
      {/* Imagem 4:3 — só renderiza quando a prop image for fornecida */}
      {image !== undefined && (
        <div className="aspect-[4/3] overflow-hidden bg-brand-50">
          <img
            src={image}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Conteúdo */}
      <div className={bodyClassName}>
        {name && (
          <p className="text-base font-semibold text-ink leading-snug">{name}</p>
        )}
        {price && (
          <p className="text-[18px] font-bold text-brand-700 mt-1">{price}</p>
        )}
        {unit && (
          <p className="text-xs text-ink-mute mt-0.5">{unit}</p>
        )}
        {children}
      </div>
    </div>
  )
}
