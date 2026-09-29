import { forwardRef, useMemo, useState } from 'react';
import { getListThemeAnswersQueryKey, useListThemeAnswers } from '@workspace/api-client-react';
import type { Locale } from '@/i18n';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MAX_SUGGESTIONS = 8;

// Same spirit as the server's guess normalization (game.ts `clean`): case,
// accents and punctuation don't matter, so "pokemon" finds "Pokémon".
const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

type Candidate = { label: string; normalized: string; words: string[] };

// Titles starting with the query first, then titles with a word starting
// with it, then any other match — so "star" ranks "Star Wars" above
// "Lone Star" above "Mustard".
function filterSuggestions(candidates: Candidate[], query: string) {
  const needle = normalize(query);
  if (!needle) return [];
  const ranked: { label: string; rank: number }[] = [];
  for (const candidate of candidates) {
    if (candidate.normalized.startsWith(needle)) ranked.push({ label: candidate.label, rank: 0 });
    else if (candidate.words.some((word) => word.startsWith(needle))) ranked.push({ label: candidate.label, rank: 1 });
    else if (candidate.normalized.includes(needle)) ranked.push({ label: candidate.label, rank: 2 });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.label);
}

/** Every answer of the theme, for autocompletion — only fetched for themes
 * that opt into it server-side (movies, series, video games). */
export function useGuessSuggestions(themeId: string, locale: Locale, enabled: boolean) {
  const params = { themeId, locale };
  const { data } = useListThemeAnswers(params, {
    query: { queryKey: getListThemeAnswersQueryKey(params), enabled: enabled && Boolean(themeId), staleTime: Infinity },
  });
  return enabled ? data : undefined;
}

type GuessInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Called when a suggestion is chosen (click or Enter on a highlighted
   * one): the guess is submitted right away, no extra keystroke. */
  onPick: (value: string) => void;
  /** Undefined → plain input, no autocompletion. */
  suggestions?: string[];
};

export const GuessInput = forwardRef<HTMLInputElement, GuessInputProps>(
  ({ value, onValueChange, onPick, suggestions, onKeyDown, onBlur, ...inputProps }, ref) => {
    const [highlighted, setHighlighted] = useState(-1);
    const [open, setOpen] = useState(true);

    const candidates = useMemo<Candidate[]>(
      () =>
        (suggestions ?? []).map((label) => {
          const normalized = normalize(label);
          return { label, normalized, words: normalized.split(' ') };
        }),
      [suggestions],
    );
    const matches = useMemo(() => filterSuggestions(candidates, value), [candidates, value]);
    const showList = open && matches.length > 0 && !inputProps.disabled && !inputProps.readOnly;

    const pick = (label: string) => {
      setHighlighted(-1);
      setOpen(false);
      onPick(label);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (showList) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          // Cycles through -1 (nothing highlighted: Enter submits what was
          // typed) and every suggestion.
          setHighlighted((current) => ((current + 1 + step + matches.length + 1) % (matches.length + 1)) - 1);
          return;
        }
        if (event.key === 'Enter' && highlighted >= 0 && matches[highlighted]) {
          event.preventDefault();
          pick(matches[highlighted]!);
          return;
        }
        if (event.key === 'Tab' && matches[Math.max(0, highlighted)]) {
          event.preventDefault();
          onValueChange(matches[Math.max(0, highlighted)]!);
          setHighlighted(-1);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
          return;
        }
      }
      onKeyDown?.(event);
    };

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          value={value}
          autoComplete="off"
          role={suggestions ? 'combobox' : undefined}
          aria-expanded={suggestions ? showList : undefined}
          aria-autocomplete={suggestions ? 'list' : undefined}
          onChange={(event) => {
            onValueChange(event.target.value);
            setHighlighted(-1);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            setOpen(false);
            onBlur?.(event);
          }}
          onFocus={() => setOpen(true)}
          {...inputProps}
        />
        {showList && (
          // Opens upward: the guess field sits at the bottom of the game
          // screen, a downward list would fall off-screen on small viewports.
          <ul
            role="listbox"
            className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-80 overflow-y-auto rounded-xl border border-primary/30 bg-popover/95 p-1 text-left shadow-2xl backdrop-blur-md"
          >
            {matches.map((label, index) => (
              <li
                key={label}
                role="option"
                aria-selected={index === highlighted}
                // mousedown + preventDefault keeps focus in the input (no
                // blur → list closing before the click registers).
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(label);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={cn(
                  'cursor-pointer truncate rounded-lg px-4 py-2 text-base',
                  index === highlighted ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
GuessInput.displayName = 'GuessInput';
