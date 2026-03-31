import React, { useState, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { MapPin, FolderOpen, FolderPlus, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

function FolderItem({ name, count, onSelect, onFolderDeleted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef(null);
  const touchMoved = useRef(false);

  const handleTouchStart = useCallback((e) => {
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        setMenuOpen(true);
      }
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  }, []);

  const handleClick = useCallback(() => {
    if (!touchMoved.current) {
      onSelect(name);
    }
  }, [onSelect, name]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Eroare la ștergere');
      }
      toast.success(`Folder „${name}" șters`);
      setDeleteDialogOpen(false);
      setMenuOpen(false);
      if (onFolderDeleted) onFolderDeleted();
    } catch (err) {
      toast.error('Nu s-a putut șterge: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-secondary/50 transition-colors select-none"
        data-testid="locality-folder-item"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
            <MapPin className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="text-left">
            <p className="font-medium">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{count || 0}</Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>

      {/* Long-press bottom sheet menu */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base font-['Space_Grotesk'] text-left flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {name}
            </SheetTitle>
          </SheetHeader>
          <Separator className="mb-2" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-14 text-base rounded-xl text-[hsl(var(--gal-danger))] hover:text-[hsl(var(--gal-danger))] hover:bg-[hsl(var(--gal-danger))]/10"
            onClick={() => {
              setMenuOpen(false);
              // Small delay to let bottom sheet close before opening dialog
              setTimeout(() => setDeleteDialogOpen(true), 200);
            }}
            data-testid="folder-menu-delete"
          >
            <Trash2 className="h-5 w-5" />
            Șterge folderul
          </Button>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-32px)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-['Space_Grotesk']">Șterge folderul?</AlertDialogTitle>
            <AlertDialogDescription>
              Folderul „{name}" va fi șters. Rapoartele din acest folder nu vor fi șterse, dar vor rămâne neasignate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-xl">
              Anulează
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12 rounded-xl bg-[hsl(var(--gal-danger))] hover:bg-[hsl(var(--gal-danger))]/90 text-white"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="folder-delete-confirm-button"
            >
              {deleting ? 'Se șterge...' : 'Șterge definitiv'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function LocalitiesDrawer({ open, onClose, localities, onSelectLocality, onLocalitiesChanged }) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  const totalCount = localities.reduce((sum, loc) => sum + (loc.count || 0), 0);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/localities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.status === 409) {
        toast.error('Acest folder există deja');
        return;
      }
      if (!res.ok) throw new Error('Eroare la creare');
      toast.success(`Folder "${name}" creat`);
      setCreateDialogOpen(false);
      setNewFolderName('');
      if (onLocalitiesChanged) onLocalitiesChanged();
    } catch (err) {
      toast.error('Nu s-a putut crea folderul: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0">
          <SheetHeader className="px-4 pt-6 pb-4">
            <SheetTitle className="text-xl font-['Space_Grotesk'] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Localități
            </SheetTitle>
          </SheetHeader>

          <Separator />

          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-2">
              {/* All meetings */}
              <button
                onClick={() => onSelectLocality(null)}
                className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-secondary/50 transition-colors"
                data-testid="locality-folder-item-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Toate întâlnirile</p>
                    <p className="text-xs text-muted-foreground">{totalCount} înregistrări</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <Separator className="my-1" />

              {/* Locality folders */}
              {localities.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Nicio localitate încă.</p>
                  <p className="text-xs mt-1">Creați un folder sau înregistrați o ședință.</p>
                </div>
              ) : (
                localities.map((loc) => (
                  <FolderItem
                    key={loc.name}
                    name={loc.name}
                    count={loc.count}
                    onSelect={onSelectLocality}
                    onFolderDeleted={onLocalitiesChanged}
                  />
                ))
              )}
            </div>
          </ScrollArea>

          {/* Create folder button */}
          <div className="p-4 border-t border-border">
            <Button
              onClick={() => {
                setNewFolderName('');
                setCreateDialogOpen(true);
              }}
              variant="outline"
              className="w-full h-12 rounded-xl gap-2 text-sm font-medium border-primary/20 text-primary"
              data-testid="create-folder-button"
            >
              <FolderPlus className="h-5 w-5" />
              Creează folder nou
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create folder dialog */}
      <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <AlertDialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-32px)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-['Space_Grotesk']">Folder nou</AlertDialogTitle>
            <AlertDialogDescription>
              Introduceți numele localității pentru noul folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Ex: Sulina, Letea..."
            className="h-12 rounded-xl text-base"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
            }}
            data-testid="create-folder-name-input"
          />
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-xl">Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="h-12 rounded-xl bg-primary hover:bg-primary/90"
              onClick={handleCreateFolder}
              disabled={creating || !newFolderName.trim()}
              data-testid="create-folder-confirm-button"
            >
              {creating ? 'Se creează...' : 'Creează'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
