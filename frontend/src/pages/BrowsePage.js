import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import MeetingCard from '../components/MeetingCard';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Search, MapPin, Filter, FileAudio, X } from 'lucide-react';

export default function BrowsePage({ backendUrl, localities }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLocality = searchParams.get('locality') || null;
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

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

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const clearLocality = () => {
    setSearchParams({});
  };

  return (
    <div className="px-4 py-4 space-y-4 safe-bottom">
      {/* Search */}
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

      {/* Locality filter chips */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={!activeLocality ? 'default' : 'secondary'}
          className="cursor-pointer px-3 py-1.5 text-sm"
          onClick={clearLocality}
          data-testid="locality-chip-all"
        >
          Toate ({total})
        </Badge>
        {localities.map(loc => (
          <Badge
            key={loc.name}
            variant={activeLocality === loc.name ? 'default' : 'secondary'}
            className="cursor-pointer px-3 py-1.5 text-sm gap-1"
            onClick={() => {
              if (activeLocality === loc.name) {
                clearLocality();
              } else {
                setSearchParams({ locality: loc.name });
              }
            }}
            data-testid="locality-chip"
          >
            <MapPin className="h-3 w-3" />
            {loc.name} ({loc.count})
          </Badge>
        ))}
      </div>

      {/* Active filter indicator */}
      {activeLocality && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtrat: <strong>{activeLocality}</strong></span>
          <Button variant="ghost" size="icon" onClick={clearLocality} className="h-6 w-6">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Meeting list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16">
          <FileAudio className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">
            {searchQuery || activeLocality 
              ? 'Niciun rezultat găsit'
              : 'Nicio întâlnire încă'
            }
          </p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            {searchQuery || activeLocality
              ? 'Încercați altă căutare sau filtrare'
              : 'Începeți prin a înregistra prima ședință'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting._id}
              meeting={meeting}
              onDeleted={(id) => {
                setMeetings(prev => prev.filter(m => m._id !== id));
                setTotal(prev => prev - 1);
              }}
              onUpdated={(updated) => {
                setMeetings(prev => prev.map(m => m._id === updated._id ? updated : m));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
