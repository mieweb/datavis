import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@mieweb/ui/components/Button';
import { DropdownItem, type DropdownItemProps } from '@mieweb/ui/components/Dropdown';

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', ...props }, ref) => (
    <Button
      ref={ref}
      size="icon"
      variant={variant}
      className={joinClassNames('h-7 w-7', className)}
      {...props}
    />
  ),
);

IconButton.displayName = 'IconButton';

export type InlineActionButtonProps = ButtonProps;

export const InlineActionButton = forwardRef<HTMLButtonElement, InlineActionButtonProps>(
  ({ className, variant = 'link', size = 'sm', ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={joinClassNames('h-auto px-0 py-0 text-xs', className)}
      {...props}
    />
  ),
);

InlineActionButton.displayName = 'InlineActionButton';

export type TableActionButtonProps = ButtonProps;

export const TableActionButton = forwardRef<HTMLButtonElement, TableActionButtonProps>(
  ({ className, variant = 'ghost', size = 'sm', ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={joinClassNames('h-7 px-1.5 text-xs', className)}
      {...props}
    />
  ),
);

TableActionButton.displayName = 'TableActionButton';

export interface DisclosureButtonProps extends ButtonProps {
  indicator?: ReactNode;
}

export const DisclosureButton = forwardRef<HTMLButtonElement, DisclosureButtonProps>(
  ({ className, variant = 'ghost', size = 'sm', indicator, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={joinClassNames('h-auto w-full justify-start px-3 py-2 text-sm font-medium', className)}
      {...props}
    >
      {indicator}
      {children}
    </Button>
  ),
);

DisclosureButton.displayName = 'DisclosureButton';

export interface MenuActionProps extends DropdownItemProps {
  checked?: boolean;
  shortcut?: ReactNode;
}

export const MenuAction = forwardRef<HTMLButtonElement, MenuActionProps>(
  ({ checked = false, shortcut, children, className, ...props }, ref) => (
    <DropdownItem
      ref={ref}
      className={joinClassNames('gap-2', className)}
      {...props}
    >
      <span className="w-4 text-center text-xs" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
      <span className="flex-1 text-left">{children}</span>
      {shortcut ? <span className="ml-2 text-xs text-gray-400">{shortcut}</span> : null}
    </DropdownItem>
  ),
);

MenuAction.displayName = 'MenuAction';