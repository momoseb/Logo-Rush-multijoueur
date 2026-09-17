import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Flag, ImageOff, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getBrandfetchUrl } from '@/components/pixelated-logo';

type Logo = {
  id: string;
  domain: string;
  answer: string;
  imageUrl: string;
};

type LogoState = 'loading' | 'valid' | 'lettermark' | 'missing';

const PAGE_SIZE = 24;
const STORAGE_KEY = 'logo-rush:flagged-logos';

function AuditLogo({ logo, flagged, onToggleFlag }: { logo: Logo; flagged: boolean; onToggleFlag: () => void }) {
  const [state, setState] = useState<LogoState>('loading');
  const [src, setSrc] = useState(() => getBrandfetchUrl(logo.imageUrl, false));

  useEffect(() => {
    setState('loading');
    setSrc(getBrandfetchUrl(logo.imageUrl, false));
  }, [logo.imageUrl]);

  const handleError = () => {
    if (state === 'loading' && logo.imageUrl.startsWith('brandfetch://')) {
      setState('lettermark');
      setSrc(getBrandfetchUrl(logo.imageUrl, true));
    } else {
      setState('missing');
    }
  };

  return (
    <Card className={flagged || state === 'missing' || state === 'lettermark' ? 'border-amber-500/70 bg-amber-500/5' : 'bg-card/50'}>
      <CardContent className="p-4 space-y-4">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white p-4">
          {state !== 'missing' ? (
            <img
              src={src}
              alt={`Logo ${logo.answer}`}
              className="h-full w-full object-contain"
              onLoad={() => setState((current) => current === 'lettermark' ? 'lettermark' : 'valid')}
              onError={handleError}
              data-testid={`img-audit-${logo.id}`}
            />
          ) : (
            <ImageOff className="h-12 w-12 text-destructive" data-testid={`status-missing-${logo.id}`} />
          )}
          {state === 'loading' && <span className="absolute text-xs text-muted-foreground">Chargement…</span>}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-bold" data-testid={`text-logo-name-${logo.id}`}>{logo.answer}</h2>
            {state === 'valid' && <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />OK</Badge>}
            {state === 'lettermark' && <Badge className="bg-amber-500 text-black"><AlertTriangle className="mr-1 h-3 w-3" />Lettermark</Badge>}
            {state === 'missing' && <Badge variant="destructive">Absente</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground" data-testid={`text-logo-domain-${logo.id}`}>{logo.domain}</p>
        </div>
        <Button
          type="button"
          variant={flagged ? 'secondary' : 'outline'}
          className="w-full"
          onClick={onToggleFlag}
          data-testid={`button-flag-${logo.id}`}
        >
          <Flag className="h-4 w-4" />
          {flagged ? 'Signalé' : 'Signaler ce visuel'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function LogoAudit() {
  const [, setLocation] = useLocation();
  const [logos, setLogos] = useState<Logo[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [flagged, setFlagged] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    fetch('/api/game/logos')
      .then((response) => {
        if (!response.ok) throw new Error('Catalogue indisponible');
        return response.json() as Promise<Logo[]>;
      })
      .then(setLogos)
      .catch(() => setError('Impossible de charger le catalogue de logos.'));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return logos;
    return logos.filter((logo) =>
      logo.answer.toLocaleLowerCase().includes(normalized)
      || logo.domain.toLocaleLowerCase().includes(normalized),
    );
  }, [logos, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageLogos = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleFlag = (id: string) => {
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="flex-1 py-6 sm:py-10">
      <header className="mb-8 space-y-5">
        <Button variant="ghost" onClick={() => setLocation('/')} data-testid="button-back-home">
          <ArrowLeft /> Retour au jeu
        </Button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Outil interne</p>
          <h1 className="text-4xl font-extrabold tracking-tight">Contrôle des 404 logos</h1>
          <p className="mt-2 text-muted-foreground">
            Vérifiez le nom et le domaine attendus. Les images absentes et les lettermarks sont détectés automatiquement.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Rechercher une marque ou un domaine…"
              className="pl-9"
              data-testid="input-logo-search"
            />
          </div>
          <Badge variant="outline" className="h-9 justify-center px-4" data-testid="text-audit-count">
            {filtered.length} logo{filtered.length > 1 ? 's' : ''} · {flagged.size} signalé{flagged.size > 1 ? 's' : ''}
          </Badge>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive" data-testid="status-audit-error">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pageLogos.map((logo) => (
              <AuditLogo key={logo.id} logo={logo} flagged={flagged.has(logo.id)} onToggleFlag={() => toggleFlag(logo.id)} />
            ))}
          </div>
          <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)} data-testid="button-page-previous">
              Précédente
            </Button>
            <span className="text-sm font-medium" data-testid="text-page-number">Page {page} sur {pageCount}</span>
            <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} data-testid="button-page-next">
              Suivante
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}