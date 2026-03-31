import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import StatusBadge from './StatusBadge';
import { MapPin, Calendar, ChevronRight, Trash2, Pencil } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Separator } from './ui/separator';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function MeetingCard({ meeting, onDeleted, onUpdated }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const longPressTimer = useRef(null);
  const touchMoved = useRef(false);

  const handleTouchStart = useCallback((e) => {
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        e.preventDefault?.();
        setMenuOpen(true);
      }
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true;
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleContextMenu = useCallback((e) => { e.preventDefault(); setMenuOpen(true); }, []);

  const handleClick = useCallback(() => {
    if (!menuOpen && !touchMoved.current) navigate(`/meeting/${meeting._id}`);
  }, [menuOpen, navigate, meeting._id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${meeting._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Eroare la ștergere');
      toast.success('Întâlnire ștearsă');
      setDeleteDialogOpen(false);
      setMenuOpen(false);
      if (onDeleted) onDeleted(meeting._id);
    } catch (err) { toast.error('Nu s-a putut șterge: ' + err.message); }
    finally { setDeleting(false); }
  };

  const handleSaveTitle = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/meetings/${meeting._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (!res.ok) throw new Error('Eroare la salvare');
      const updated = await res.json();
      toast.success('Titlu actualizat');
      setEditDialogOpen(false);
      setMenuOpen(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) { toast.error('Nu s-a putut salva: ' + err.message); }
    finally { setSaving(false); }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <>
      <Card
        className="p-4 rounded-2xl shadow-[0_6px_18px_hsl(var(--gal-shadow))] cursor-pointer active:scale-[0.97] transition-transform duration-100 select-none will-change-transform"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="meeting-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate font-semibold">
              {meeting.title || 'Ședință fără titlu'}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              {meeting.locality && (
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <MapPin className="h-3 w-3" /> {meeting.locality}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> {formatDate(meeting.date || meeting.created_at)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={meeting.status} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </Card>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base font-semibold truncate text-left">
              {meeting.title || 'Ședință fără titlu'}
            </SheetTitle>
          </SheetHeader>
          <Separator className="mb-2" />
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-14 text-base rounded-xl active:scale-[0.98] transition-transform"
              onClick={() => { setNewTitle(meeting.title || ''); setMenuOpen(false); setTimeout(() => setEditDialogOpen(true), 200); }}
              data-testid="meeting-menu-edit"
            >
              <Pencil className="h-5 w-5 text-primary" /> Editare nume
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-14 text-base rounded-xl text-[hsl(var(--gal-danger))] hover:text-[hsl(var(--gal-danger))] hover:bg-[hsl(var(--gal-danger))]/10 active:scale-[0.98] transition-transform"
              onClick={() => { setMenuOpen(false); setTimeout(() => setDeleteDialogOpen(true), 200); }}
              data-testid="meeting-menu-delete"
            >
              <Trash2 className="h-5 w-5" /> Șterge întâlnirea
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-32px)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Editare nume</AlertDialogTitle>
            <AlertDialogDescription>Introduceți noul titlu al întâlnirii.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titlu întâlnire..."
            className="h-12 rounded-xl text-base" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); }}
            data-testid="meeting-edit-title-input" />
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-xl">Anulează</AlertDialogCancel>
            <AlertDialogAction className="h-12 rounded-xl bg-primary hover:bg-primary/90" onClick={handleSaveTitle}
              disabled={saving || !newTitle.trim()} data-testid="meeting-edit-save-button">
              {saving ? 'Se salvează...' : 'Salvează'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="mx-4 rounded-2xl max-w-[calc(100vw-32px)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">Șterge întâlnirea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune este ireversibilă. Întâlnirea, transcrierea și toate datele asociate vor fi șterse definitiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12 rounded-xl">Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="h-12 rounded-xl bg-[hsl(var(--gal-danger))] hover:bg-[hsl(var(--gal-danger))]/90 text-white"
              onClick={handleDelete} disabled={deleting} data-testid="meeting-delete-confirm-button">
              {deleting ? 'Se șterge...' : 'Șterge definitiv'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
