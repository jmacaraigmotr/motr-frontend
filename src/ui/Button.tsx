import { forwardRef } from 'react'
import type { ElementType, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leadingIcon?: ReactNode
  loading?: boolean
  as?: ElementType
  fullWidth?: boolean
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--text-strong)] text-white border-transparent hover:opacity-90 active:opacity-80',
  secondary:
    'bg-[var(--surface-0)] text-[var(--text-default)] border-[var(--line)] hover:bg-[var(--surface-1)] active:bg-[var(--surface-2)]',
  ghost:
    'bg-transparent text-[var(--text-default)] border-transparent hover:bg-[var(--surface-1)] active:bg-[var(--surface-2)]',
  danger:
    'bg-transparent text-[var(--danger-fg)] border-[var(--danger-border)] hover:bg-[var(--danger-bg)] active:opacity-80',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-[var(--btn-height-sm)] px-3 text-[13px] gap-[6px]',
  md: 'h-[var(--btn-height-md)] px-4 text-[14px] gap-2',
  lg: 'h-[var(--btn-height-lg)] px-5 text-[15px] gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      leadingIcon,
      loading = false,
      as,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...rest
    },
    ref,
  ) => {
    const Tag = (as ?? 'button') as ElementType

    return (
      <Tag
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center rounded-[var(--radius-md)] border font-medium',
          'transition-all duration-[var(--motion-duration)] ease-[var(--motion-ease)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--info)] focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'select-none whitespace-nowrap',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? (
          <span
            className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          leadingIcon && (
            <span className="shrink-0 flex items-center" aria-hidden="true">
              {leadingIcon}
            </span>
          )
        )}
        {children}
      </Tag>
    )
  },
)

Button.displayName = 'Button'
