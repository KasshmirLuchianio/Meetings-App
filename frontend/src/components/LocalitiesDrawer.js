import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { MapPin, FolderOpen, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

export default function LocalitiesDrawer({ open, onClose, localities, onSelectLocality }) {
  const totalCount = localities.reduce((sum, loc) => sum + loc.count, 0);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0">
        <SheetHeader className="px-4 pt-6 pb-4">
          <SheetTitle className="text-xl font-['Space_Grotesk'] flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Localități
          </SheetTitle>
        </SheetHeader>

        <Separator />

        <ScrollArea className="h-[calc(100vh-120px)]">
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
                <p className="text-xs mt-1">Localitățile vor apărea automat după prima înregistrare.</p>
              </div>
            ) : (
              localities.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => onSelectLocality(loc.name)}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-secondary/50 transition-colors"
                  data-testid="locality-folder-item"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{loc.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{loc.count}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
