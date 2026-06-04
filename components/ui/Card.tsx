import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  image?: string
  imageAlt?: string
  name?: string
  price?: string
  unit?: string
}

export function Card({
  image,
  imageAlt = '',
  name,
  price,
  unit,
  children,
  className = '',
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
      {/* Imagem 4:3 */}
      <div className="aspect-[4/3] overflow-hidden bg-brand-50">
        {image ? (
          <img
            src={image}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-mute text-sm">
            Sem imagem
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4">
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
