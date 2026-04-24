import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, RefreshControl,
  ActivityIndicator, TextInput, Alert, Modal, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronRight, FolderOpen, Search, Filter, X, Trash2, Edit3 } from 'lucide-react-native';
import TopBar from '../src/components/TopBar';
import { API_BASE_URL } from '../src/constants/config';
import { COLORS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';

interface Meeting {
  _id: string;
  title?: string;
  locality?: string;
  created_at: string;
  status: string;
  vertical_type?: string;
}

interface GroupedMeetings {
  vertical: string;
  meetings: Meeting[];
}

const VERTICAL_COLORS: Record<string, string> = {
  GAL: '#2563EB',
  GENERAL: COLORS.navy,
  JOURNALISM: '#DC2626',
  LEGAL: '#059669',
  BANKING: '#7C3AED',
  HEALTHCARE: '#0891B2',
  STARTUPS: '#EA580C',
};

const VERTICAL_LABELS: Record<string, string> = {
  GAL: 'Administrație',
  GENERAL: 'General',
  JOURNALISM: 'Jurnalism',
  LEGAL: 'Juridic',
  BANKING: 'Bancar',
  HEALTHCARE: 'Sănătate',
  STARTUPS: 'Startup',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'În așteptare',
  uploading: 'Se încarcă',
  transcribing: 'Transcriere',
  processing: 'Procesare',
  processed: 'Finalizat',
  done: 'Finalizat',
  failed: 'Eșuat',
  error: 'Eșuat',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  uploading: '#3B82F6',
  transcribing: '#8B5CF6',
  processing: '#10B981',
  processed: '#059669',
  done: '#059669',
  failed: '#EF4444',
  error: '#EF4444',
};

export default function BrowseScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Rename modal (cross-platform)
  const [renameModal, setRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Meeting | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    fetchMeetings(1, true);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedVertical, selectedStatus, allMeetings]);

  const fetchMeetings = async (page: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setCurrentPage(1);
      } else {
        setLoadingMore(true);
      }

      const response = await authenticatedFetch(`${API_BASE_URL}/api/meetings?page=${page}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch meetings');

      const data = await response.json();

      if (reset) {
        setAllMeetings(data.meetings || []);
        setMeetings(data.meetings || []);
      } else {
        const newMeetings = [...allMeetings, ...(data.meetings || [])];
        setAllMeetings(newMeetings);
        setMeetings(newMeetings);
      }

      setTotalPages(data.pages || 1);
      setCurrentPage(page);
      setHasMore(page < (data.pages || 1));
    } catch {
      // silently fail — list stays as-is
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadMeetings = () => fetchMeetings(1, true);

  const loadMore = () => {
    if (!loadingMore && hasMore && !searchQuery && !selectedVertical && !selectedStatus) {
      fetchMeetings(currentPage + 1, false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allMeetings];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) => m.title?.toLowerCase().includes(query) || m.locality?.toLowerCase().includes(query)
      );
    }
    if (selectedVertical) filtered = filtered.filter((m) => m.vertical_type === selectedVertical);
    if (selectedStatus) filtered = filtered.filter((m) => m.status === selectedStatus);

    setMeetings(filtered);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setSearchQuery('');
    setSelectedVertical(null);
    setSelectedStatus(null);
    fetchMeetings(1, true);
  }, []);

  // ── Long press actions ──────────────────────────────────────────
  const handleLongPress = (meeting: Meeting) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      meeting.title || formatDate(meeting.created_at),
      'Ce vrei să faci cu această înregistrare?',
      [
        { text: 'Redenumește', onPress: () => openRenameModal(meeting) },
        { text: 'Șterge', style: 'destructive', onPress: () => confirmDelete(meeting) },
        { text: 'Anulează', style: 'cancel' },
      ]
    );
  };

  const confirmDelete = (meeting: Meeting) => {
    Alert.alert(
      'Șterge înregistrarea',
      'Această acțiune este ireversibilă. Înregistrarea și raportul vor fi șterse definitiv.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: () => deleteMeeting(meeting),
        },
      ]
    );
  };

  const deleteMeeting = async (meeting: Meeting) => {
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/meetings/${meeting._id}`, { method: 'DELETE' });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        loadMeetings();
      } else {
        Alert.alert('Eroare', 'Nu am putut șterge înregistrarea.');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea la internet.');
    }
  };

  const openRenameModal = (meeting: Meeting) => {
    setRenameTarget(meeting);
    setRenameValue(meeting.title || '');
    setRenameModal(true);
  };

  const submitRename = async () => {
    if (!renameValue.trim() || !renameTarget) return;
    setRenameLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/meetings/${renameTarget._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setRenameModal(false);
        loadMeetings();
      } else {
        Alert.alert('Eroare', 'Nu am putut redenumi înregistrarea.');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea la internet.');
    } finally {
      setRenameLoading(false);
    }
  };

  // ── Utils ───────────────────────────────────────────────────────
  const handleMeetingPress = (meetingId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/meeting/${meetingId}`);
  };

  const toggleFilter = (type: 'vertical' | 'status', value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'vertical') setSelectedVertical(selectedVertical === value ? null : value);
    else setSelectedStatus(selectedStatus === value ? null : value);
  };

  const clearAllFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSearchQuery('');
    setSelectedVertical(null);
    setSelectedStatus(null);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    } catch {
      return '';
    }
  };

  const groupByVertical = (): GroupedMeetings[] => {
    const grouped: Record<string, Meeting[]> = {};
    meetings.forEach((meeting) => {
      const vertical = meeting.vertical_type || 'GENERAL';
      if (!grouped[vertical]) grouped[vertical] = [];
      grouped[vertical].push(meeting);
    });
    return Object.entries(grouped).map(([vertical, meets]) => ({ vertical, meetings: meets }));
  };

  // ── Render ──────────────────────────────────────────────────────
  const renderMeetingItem = ({ item }: { item: Meeting }) => {
    const vertColor = VERTICAL_COLORS[item.vertical_type || 'GENERAL'] || COLORS.navy;
    const statusColor = STATUS_COLORS[item.status] || '#6B7280';

    return (
      <Pressable
        onPress={() => handleMeetingPress(item._id)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        className="bg-white rounded-xl p-4 mb-3 active:bg-gray-50"
        style={{ borderLeftWidth: 4, borderLeftColor: vertColor }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-navy text-base font-heading mb-1" numberOfLines={2}>
              {item.title || `${formatDate(item.created_at)}${item.locality ? ` | ${item.locality}` : ''}`}
            </Text>

            <View className="flex-row items-center gap-2 flex-wrap mt-1">
              <View className="px-2 py-1 rounded-md" style={{ backgroundColor: vertColor + '20' }}>
                <Text className="text-xs font-heading" style={{ color: vertColor }}>
                  {VERTICAL_LABELS[item.vertical_type || 'GENERAL'] || item.vertical_type}
                </Text>
              </View>
              <View className="px-2 py-1 rounded-md" style={{ backgroundColor: statusColor + '20' }}>
                <Text className="text-xs font-body" style={{ color: statusColor }}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
              <Text className="text-xs text-gray-400 font-body">{formatDate(item.created_at)}</Text>
            </View>
          </View>
          <ChevronRight size={20} color={COLORS.navy} />
        </View>
      </Pressable>
    );
  };

  const renderVerticalSection = ({ item }: { item: GroupedMeetings }) => {
    const color = VERTICAL_COLORS[item.vertical] || COLORS.navy;
    return (
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3 px-4">
          <View className="h-8 w-8 rounded-lg items-center justify-center" style={{ backgroundColor: color + '20' }}>
            <FolderOpen size={18} color={color} />
          </View>
          <Text className="text-navy text-lg font-heading">
            {VERTICAL_LABELS[item.vertical] || item.vertical}
          </Text>
          <View className="h-6 px-2 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.navy + '10' }}>
            <Text className="text-navy text-xs font-heading">{item.meetings.length}</Text>
          </View>
        </View>
        <View className="px-4">
          {item.meetings.map((meeting) => (
            <View key={meeting._id}>{renderMeetingItem({ item: meeting })}</View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-ivory">
        <TopBar showBack />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text className="text-navy font-body mt-4">Se încarcă întâlnirile...</Text>
        </View>
      </View>
    );
  }

  const groupedData = groupByVertical();
  const activeFiltersCount = [searchQuery, selectedVertical, selectedStatus].filter(Boolean).length;

  if (groupedData.length === 0 && !searchQuery && !selectedVertical && !selectedStatus) {
    return (
      <View className="flex-1 bg-ivory">
        <TopBar showBack />
        <View className="flex-1 justify-center items-center px-6">
          <View className="h-20 w-20 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: COLORS.navy + '10' }}>
            <FolderOpen size={40} color={COLORS.navy} />
          </View>
          <Text className="text-navy text-xl font-heading mb-2 text-center">Nicio întâlnire încă</Text>
          <Text className="text-gray-600 text-base font-body text-center">
            Înregistrează sau încarcă prima ta întâlnire din ecranul Acasă
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ivory">
      <TopBar showBack />

      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 bg-white rounded-xl px-4 py-3 flex-row items-center gap-2">
            <Search size={20} color={COLORS.navy} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Caută după titlu sau localitate..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 text-navy font-body"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={20} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => setShowFilters(!showFilters)} className="bg-white rounded-xl p-3">
            <View className="relative">
              <Filter size={20} color={COLORS.navy} />
              {activeFiltersCount > 0 && (
                <View className="absolute -top-1 -right-1 h-4 w-4 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.navy }}>
                  <Text className="text-white text-xs font-heading">{activeFiltersCount}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View className="bg-white mx-4 mb-2 p-4 rounded-xl">
          <Text className="text-navy text-sm font-heading mb-2">Status:</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {(['done', 'processing', 'failed'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => toggleFilter('status', key)}
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: selectedStatus === key ? STATUS_COLORS[key] : STATUS_COLORS[key] + '20' }}
              >
                <Text className="text-xs font-body" style={{ color: selectedStatus === key ? 'white' : STATUS_COLORS[key] }}>
                  {STATUS_LABELS[key]}
                </Text>
              </Pressable>
            ))}
          </View>
          {activeFiltersCount > 0 && (
            <Pressable onPress={clearAllFilters} className="bg-gray-100 rounded-lg py-2 items-center">
              <Text className="text-gray-700 text-sm font-body">Șterge filtrele</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Hint */}
      <View className="px-4 pb-1">
        <Text className="text-gray-400 text-xs font-body">Apasă lung pe o înregistrare pentru opțiuni</Text>
      </View>

      {/* List */}
      {groupedData.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-navy text-lg font-heading mb-2">Niciun rezultat</Text>
          <Text className="text-gray-600 text-base font-body text-center">
            Încearcă să modifici criteriile de căutare sau filtrele
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          renderItem={renderVerticalSection}
          keyExtractor={(item) => item.vertical}
          contentContainerStyle={{ paddingVertical: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.navy} colors={[COLORS.navy]} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => loadingMore ? <View className="py-4"><ActivityIndicator size="small" color={COLORS.navy} /></View> : null}
        />
      )}

      {/* Rename Modal */}
      <Modal visible={renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(false)}>
        <View style={m.overlay}>
          <View style={m.box}>
            <View style={m.boxHeader}>
              <Edit3 size={20} color={COLORS.navy} />
              <Text style={m.boxTitle}>Redenumește înregistrarea</Text>
            </View>
            <TextInput
              style={m.input}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              placeholder="Titlu nou"
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              onSubmitEditing={submitRename}
            />
            <View style={m.btnRow}>
              <Pressable style={m.cancelBtn} onPress={() => setRenameModal(false)}>
                <Text style={m.cancelText}>Anulează</Text>
              </Pressable>
              <Pressable style={[m.confirmBtn, renameLoading && { opacity: 0.6 }]} onPress={submitRename} disabled={renameLoading}>
                {renameLoading
                  ? <ActivityIndicator size={16} color="#FAF8F3" />
                  : <Text style={m.confirmText}>Salvează</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  box: {
    backgroundColor: '#FAF8F3', borderRadius: 16,
    padding: 24, width: '100%', gap: 16,
  },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boxTitle: { fontSize: 17, fontWeight: '700', color: COLORS.navy },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.navy,
    backgroundColor: '#FFFFFF',
  },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  confirmBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8,
    backgroundColor: COLORS.navy, minWidth: 80, alignItems: 'center',
  },
  confirmText: { fontSize: 14, color: '#FAF8F3', fontWeight: '700' },
});
