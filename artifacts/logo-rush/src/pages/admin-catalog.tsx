import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api-base';
import { getBrandfetchUrl } from '@/components/pixelated-logo';

const TOKEN_STORAGE_KEY = 'logo-rush-admin-token';
const PAGE_SIZE = 30;

type Theme = { id: string; nameFr: string; nameEn: string; imageProvider: string; enabled: boolean; sortOrder: number };
type CatalogItem = {
  id: string;
  themeId: string;
  answerFr: string;
  answerEn: string;
  aliasesFr: string[];
  aliasesEn: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  category: string | null;
  imageRef: string;
  active: boolean;
};

type ItemFormState = {
  id?: string;
  answerFr: string;
  answerEn: string;
  aliasesFr: string;
  aliasesEn: string;
  difficulty: 'easy' | 'medium' | 'hard';
  imageRef: string;
  active: boolean;
};

const emptyForm: ItemFormState = { answerFr: '', answerEn: '', aliasesFr: '', aliasesEn: '', difficulty: 'medium', imageRef: '', active: true };

export default function AdminCatalog() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [tokenInput, setTokenInput] = useState('');

  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' }), [token]);

  const loadThemes = async () => {
    const response = await fetch(apiUrl('/api/admin/themes'), { headers: authHeaders });
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken('');
      toast({ variant: 'destructive', description: 'Jeton invalide.' });
      return;
    }
    if (!response.ok) {
      toast({ variant: 'destructive', description: 'Impossible de charger les thèmes.' });
      return;
    }
    const data = (await response.json()) as Theme[];
    setThemes(data);
    if (!themeId && data.length > 0) setThemeId(data[0]!.id);
  };

  const loadItems = async (forThemeId: string) => {
    if (!forThemeId) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/catalog?themeId=${encodeURIComponent(forThemeId)}`), { headers: authHeaders });
      if (!response.ok) throw new Error();
      setItems((await response.json()) as CatalogItem[]);
    } catch {
      toast({ variant: 'destructive', description: 'Impossible de charger le catalogue.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) void loadThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setPage(1);
    if (token && themeId) void loadItems(themeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, themeId]);

  const saveToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    sessionStorage.setItem(TOKEN_STORAGE_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
  };

  const toggleThemeEnabled = async (theme: Theme) => {
    const response = await fetch(apiUrl(`/api/admin/themes/${theme.id}`), {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ enabled: !theme.enabled }),
    });
    if (!response.ok) {
      toast({ variant: 'destructive', description: 'Impossible de modifier le thème.' });
      return;
    }
    void loadThemes();
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => item.answerFr.toLocaleLowerCase().includes(normalized) || item.answerEn.toLocaleLowerCase().includes(normalized));
  }, [items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (item: CatalogItem) => {
    setForm({
      id: item.id,
      answerFr: item.answerFr,
      answerEn: item.answerEn,
      aliasesFr: item.aliasesFr.join(', '),
      aliasesEn: item.aliasesEn.join(', '),
      difficulty: item.difficulty,
      imageRef: item.imageRef,
      active: item.active,
    });
    setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      themeId,
      answerFr: form.answerFr.trim(),
      answerEn: form.answerEn.trim(),
      aliasesFr: form.aliasesFr.split(',').map((v) => v.trim()).filter(Boolean),
      aliasesEn: form.aliasesEn.split(',').map((v) => v.trim()).filter(Boolean),
      difficulty: form.difficulty,
      imageRef: form.imageRef.trim(),
      active: form.active,
    };
    const response = form.id
      ? await fetch(apiUrl(`/api/admin/catalog/${encodeURIComponent(form.id)}`), { method: 'PATCH', headers: authHeaders, body: JSON.stringify(payload) })
      : await fetch(apiUrl('/api/admin/catalog'), { method: 'POST', headers: authHeaders, body: JSON.stringify(payload) });
    if (!response.ok) {
      toast({ variant: 'destructive', description: 'Échec de l\'enregistrement.' });
      return;
    }
    setFormOpen(false);
    toast({ description: 'Enregistré.' });
    void loadItems(themeId);
  };

  const deleteItem = async (item: CatalogItem) => {
    if (!confirm(`Supprimer "${item.answerFr}" ?`)) return;
    const response = await fetch(apiUrl(`/api/admin/catalog/${encodeURIComponent(item.id)}`), { method: 'DELETE', headers: authHeaders });
    if (!response.ok) {
      toast({ variant: 'destructive', description: 'Échec de la suppression.' });
      return;
    }
    void loadItems(themeId);
  };

  const submitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkText);
    } catch {
      toast({ variant: 'destructive', description: 'JSON invalide.' });
      return;
    }
    const rows = Array.isArray(parsed) ? parsed.map((row) => ({ ...row, themeId })) : [];
    const response = await fetch(apiUrl('/api/admin/catalog/bulk'), { method: 'POST', headers: authHeaders, body: JSON.stringify(rows) });
    if (!response.ok) {
      toast({ variant: 'destructive', description: 'Échec de l\'import.' });
      return;
    }
    const result = (await response.json()) as { count: number };
    toast({ description: `${result.count} entrées importées.` });
    setBulkOpen(false);
    setBulkText('');
    void loadItems(themeId);
  };

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 w-full max-w-md mx-auto">
        <Card className="w-full bg-card/50 backdrop-blur-xl border-primary/20">
          <CardContent className="p-6">
            <form onSubmit={saveToken} className="space-y-4">
              <h2 className="text-xl font-semibold text-center">Administration du catalogue</h2>
              <Input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Jeton admin (ADMIN_TOKEN)"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={!tokenInput.trim()}>Entrer</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setLocation('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTheme = themes.find((t) => t.id === themeId);

  // Only "brandfetch" stores a bare domain in imageRef (e.g. "adp.com"),
  // resolved into a real CDN URL client-side like everywhere else in the
  // app (see pixelated-logo.tsx). Every other provider's imageRef is
  // already a direct, fetchable image URL — see image-providers.ts.
  const previewSrc = (item: CatalogItem) =>
    currentTheme?.imageProvider === 'brandfetch' ? getBrandfetchUrl(`brandfetch://${item.imageRef}`, false) : item.imageRef;

  return (
    <div className="flex-1 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <h1 className="text-2xl font-bold">Administration du catalogue</h1>
        <div className="w-24" />
      </div>

      <Card className="bg-card/40 backdrop-blur-md">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <Select value={themeId} onValueChange={setThemeId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Thème" /></SelectTrigger>
            <SelectContent>
              {themes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>{theme.nameFr} {theme.enabled ? '' : '(désactivé)'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentTheme && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={currentTheme.enabled} onCheckedChange={() => toggleThemeEnabled(currentTheme)} />
              Thème actif publiquement
            </label>
          )}
          <Badge variant="outline">{items.length} entrées</Badge>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import JSON
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Rechercher…" className="pl-9 max-w-sm" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((item) => (
            <Card key={item.id} className={item.active ? 'bg-card/30' : 'bg-card/10 opacity-60'}>
              <CardContent className="p-3 flex items-center gap-4">
                <img src={previewSrc(item)} alt="" className="h-12 w-12 object-contain rounded bg-background/50" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.answerFr} <span className="text-muted-foreground font-normal">/ {item.answerEn}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{item.difficulty} {item.aliasesFr.length > 0 && `· alias: ${item.aliasesFr.join(', ')}`}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteItem(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
          {pageItems.length === 0 && <p className="text-center text-muted-foreground py-8">Aucune entrée.</p>}
        </div>
      )}

      <nav className="flex items-center justify-center gap-4">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((v) => v - 1)}>Précédente</Button>
        <span className="text-sm">Page {page} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((v) => v + 1)}>Suivante</Button>
      </nav>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Modifier' : 'Ajouter'} une entrée</DialogTitle></DialogHeader>
          <form onSubmit={submitForm} className="space-y-3">
            <Input value={form.answerFr} onChange={(e) => setForm({ ...form, answerFr: e.target.value })} placeholder="Réponse (FR)" required />
            <Input value={form.answerEn} onChange={(e) => setForm({ ...form, answerEn: e.target.value })} placeholder="Réponse (EN)" required />
            <Input value={form.aliasesFr} onChange={(e) => setForm({ ...form, aliasesFr: e.target.value })} placeholder="Alias FR (séparés par des virgules)" />
            <Input value={form.aliasesEn} onChange={(e) => setForm({ ...form, aliasesEn: e.target.value })} placeholder="Alias EN (séparés par des virgules)" />
            <Input value={form.imageRef} onChange={(e) => setForm({ ...form, imageRef: e.target.value })} placeholder="URL de l'image" required />
            <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as ItemFormState['difficulty'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Facile</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="hard">Difficile</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Actif
            </label>
            <DialogFooter>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import JSON en masse</DialogTitle></DialogHeader>
          <form onSubmit={submitBulk} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tableau JSON d'objets {'{ answerFr, answerEn, aliasesFr?, aliasesEn?, difficulty?, imageRef, active? }'} pour le thème sélectionné.
            </p>
            <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10} placeholder="[{&quot;answerFr&quot;: &quot;...&quot;, &quot;answerEn&quot;: &quot;...&quot;, &quot;imageRef&quot;: &quot;https://...&quot;}]" />
            <DialogFooter>
              <Button type="submit">Importer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
