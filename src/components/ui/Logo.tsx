import Image from "next/image"

// Unificação: sob basePath, o otimizador do Next não resolve os PNGs do
// diretório público. São arquivos pequenos e estáticos — servi-los direto
// evita o erro sem mudar o visual.

// Intrinsic dimensions of the logo artwork (aspect ratio ~2.57:1).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/send"

const LOGO_WIDTH = 4525
const LOGO_HEIGHT = 1759

interface LogoProps {
  /**
   * 'auto'  — colored on light theme, white on dark theme (CSS-swapped, no hydration flash)
   * 'color' — always the colored logo (dark wordmark; needs a light background)
   * 'white' — always the white logo (needs a dark background, e.g. over the media hero)
   */
  variant?: 'auto' | 'color' | 'white'
  /** Size the logo by height; width follows the aspect ratio. */
  className?: string
  priority?: boolean
}

export function Logo({ variant = 'auto', className = 'h-8 w-auto', priority = false }: LogoProps) {
  if (variant === 'auto') {
    return (
      <>
        <Image
          src={`${BASE}/logo-colorido.png`}
          alt="ColetivoSend"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          priority={priority}
          unoptimized
          className={`${className} block dark:hidden`}
        />
        <Image
          src={`${BASE}/logo-branco.png`}
          alt=""
          aria-hidden="true"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          priority={priority}
          unoptimized
          className={`${className} hidden dark:block`}
        />
      </>
    )
  }

  return (
    <Image
      src={`${BASE}${variant === 'white' ? '/logo-branco.png' : '/logo-colorido.png'}`}
      alt="ColetivoSend"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      unoptimized
      className={className}
    />
  )
}
