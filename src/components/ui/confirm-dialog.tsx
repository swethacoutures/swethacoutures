/**
 * A promise-based replacement for `window.confirm`.
 *
 * The browser's own dialog cannot be styled, ignores dark mode, says "localhost says"
 * above the question, and on a phone it lands as a system sheet that looks nothing like
 * the rest of the app. Every destructive action in the back office used to go through it.
 *
 * Usage is deliberately a near drop-in for the call it replaces:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete this bill?' }))) return;
 *
 * The provider lives once at the app root, so any screen can ask without wiring its own
 * dialog state through props.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmOptions {
  title: string;
  /** Supporting detail. Line breaks are preserved, so a list reads as a list. */
  description?: React.ReactNode;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /**
   * Draws the confirm button in red. Use for anything that destroys data — it is the
   * difference between a button somebody reads and a button somebody clicks past.
   */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Asks the user to confirm. Resolves true if they accept, false if they cancel or dismiss.
 *
 * Falls back to `window.confirm` when no provider is mounted, so a component rendered
 * outside the app shell (a test, a stray preview) still behaves rather than throwing.
 */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  return (
    context ??
    (async (options) =>
      window.confirm(
        [options.title, typeof options.description === 'string' ? options.description : '']
          .filter(Boolean)
          .join('\n\n')
      ))
  );
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  /*
   * The pending promise's resolver.
   *
   * Held in a ref rather than state because resolving must not depend on a re-render
   * having happened — a fast double-click on Cancel would otherwise resolve twice or not
   * at all.
   */
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      // Anything still waiting is answered "no" before we replace it, so no caller hangs.
      resolver.current?.(false);
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={options !== null}
        onOpenChange={(open) => {
          // Escape, or a click on the backdrop, means no.
          if (!open) settle(false);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && (
              <AlertDialogDescription asChild>
                <div className="whitespace-pre-line text-sm text-muted-foreground">
                  {options.description}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {options?.cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={
                options?.destructive
                  ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600'
                  : undefined
              }
            >
              {options?.confirmLabel || 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
};
