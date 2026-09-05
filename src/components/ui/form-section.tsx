/**
 * A collapsible block of form fields.
 *
 * The Employee and Income/Expense dialogs had grown to the point where the Save button was
 * three or four scrolls below the first field, and on a phone the whole form was one long
 * unbroken run of inputs. Most of those fields are optional and most of the time nobody
 * touches them.
 *
 * So the optional parts fold away by default and the required ones stay open. The summary
 * line shows what is inside a closed section, so folding hides bulk without hiding meaning.
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormSectionProps {
  title: string;
  /** Shown next to the title when the section is closed — e.g. "₹1,000/day · 9 hrs". */
  summary?: React.ReactNode;
  description?: string;
  /** Sections holding required fields should pass true. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  summary,
  description,
  defaultOpen = false,
  children,
  className,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-gray-800', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/60"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
          {/* Closed sections say what is in them; open ones do not need to repeat it. */}
          {!open && summary && (
            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-500 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-200 px-3 py-3 dark:border-gray-800">
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
};

export default FormSection;
