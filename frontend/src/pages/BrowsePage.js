import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MeetingCard from '../components/MeetingCard';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Search, MapPin, Filter, FileAudio, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatedList, AnimatedItem, FadeIn } from '../components/AnimatedList';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function BrowsePage({ backendUrl, localities }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLocality = searchParams.get('locality') || null;
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newLocalityName, setNewLocalityName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${backendUrl}/api/meetings?limit=50`;
      if (activeLocality) url += `&locality=${encodeURIComponent(activeLocality)}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      setMeetings(data.meetings || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, activeLocality, searchQuery]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearLocality = () => setSearchParams({});

  const handleRenameLocality = async () => {
    const name = newLocalityName.trim();
    if (!name || !activeLocality) return;
    setRenaming(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities/${encodeURIComponent(activeLocality)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: name })
      });
      if (res.status === 409) { toast.error('O localitate cu acest nume există deja'); return; }
      if (!res.ok) throw new Error('Eroare la redenumire');
      toast.success(`Folder redenumit: ${activeLocality} → ${name}`);
      setRenameDialogOpen(false);
      setSearchParams({ locality: name });
      fetchMeetings();
    } catch (err) {
      toast.error('Nu s-a putut redenumi: ' + err.message);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4 safe-bottom">
      <FadeIn delay={0}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Caută după titlu, localitate, transcriere..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 h-12 rounded-xl text-base"
            data-testid="meetings-search-input"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={!activeLocality ? 'default' : 'secondary'}
            className="cursor-pointer px-3 py-1.5 text-sm active:scale-95 transition-transform"
            onClick={clearLocality}
            data-testid="locality-chip-all"
          >
            Toate ({total})
          </Badge>
          {localities.map(loc => (
            <Badge
              key={loc.name}
              variant={activeLocality === loc.name ? 'default' : 'secondary'}
              className="cursor-pointer px-3 py-1.5 text-sm gap-1 active:scale-95 transition-transform"
              onClick={() => activeLocality === loc.name ? clearLocality() : setSearchParams({ locality: loc.name })}
              data-testid="locality-chip"
            >
              <MapPin className="h-3 w-3" />
              {loc.name} ({loc.count || 0})
            </Badge>
          ))}
        </div>
      </FadeIn>

      {activeLocality && (
        <FadeIn delay={0}>
          <div className="flex items-center justify-between gap-2 bg-secondary/30 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Folder: <strong className="text-foreground">{activeLocality}</strong></span>
              <Button variant="ghost" size="icon" onClick={clearLocality} className="h-6 w-6 active:scale-90 transition-transform">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Button
              variant="ghost" size="sm"
              className="h-8 text-xs gap-1 text-primary active:scale-95 transition-transform"
              onClick={() => { setNewLocalityName(activeLocality); setRenameDialogOpen(true); }}
              data-testid="rename-locality-button"
            >
              <Pencil className="h-3 w-3" /> Redenumește
            </Button>
          </div>
        </FadeIn>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <FadeIn>
          <div className="text-center py-16">
            <FileAudio className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">
              {searchQuery || activeLocality ? 'Niciun rezultat găsit' : 'Nicio întâlnire încă'}
            </p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              {searchQuery || activeLocality ? 'Încercați altă căutare sau filtrare' : 'Începeți prin a înregistra prima ședință'}
            </p>
          </div>
        </FadeIn>
      ) : (
        <AnimatedList className="space-y-3">
          {meetings.map((meeting) => (
            <AnimatedItem key={meeting._id}>
              <MeetingCard
                meeting={meeting}
                onDeleted={(id) => { setMeetings(prev => prev.filter(m => m._id !== id)); setTotal(prev => prev - 1); }}
                onUpdated={(updated) => { setMeetings(prev => prev.map(m => m._id === updated._id ? updated : m)); }}
              />
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}

      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-32px)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Redenumește folderul</AlertDialogTitle>
            <AlertDialogDescription>
              Introduceți noul nume pentru folderul „{activeLocality}”. Toate rapoartele din acest folder vor fi actualizate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newLocalityName}
            onChange={(e) => setNewLocalityName(e.target.value)}
            placeholder="Numele nou..."
            className="h-12 rounded-xl text-base"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameLocality(); }}
            data-testid="rename-locality-input"
          />
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-xl">Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="h-12 rounded-xl bg-primary hover:bg-primary/90"
              onClick={handleRenameLocality}
              disabled={renaming || !newLocalityName.trim() || newLocalityName.trim() === activeLocality}
              data-testid="rename-locality-confirm-button"
            >
              {renaming ? 'Se salvează...' : 'Salvează'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
