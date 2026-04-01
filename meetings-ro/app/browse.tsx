import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronRight, FolderOpen } from 'lucide-react-native';
import TopBar from '../src/components/TopBar';
import { API_BASE_URL } from '../src/constants/config';
import { COLORS } from '../src/constants/theme';

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
  Journalism: '#DC2626',
  Legal: '#059669',
  Banking: '#7C3AED',
};

const VERTICAL_LABELS: Record<string, string> = {
  GAL: 'GAL',
  Journalism: 'Jurnalism',
  Legal: 'Juridic',
  Banking: 'Bancar',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'În așteptare',
  uploading: 'Se încarcă',
  transcribing: 'Transcriere',
  processing: 'Procesare',
  processed: 'Finalizat',
  failed: 'Eșuat',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  uploading: '#3B82F6',
  transcribing: '#8B5CF6',
  processing: '#10B981',
  processed: '#059669',
  failed: '#EF4444',
};

export default function BrowseScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeetings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      
      const data = await response.json();
      setMeetings(data.meetings || []);
    } catch (error) {
      console.error('Fetch meetings error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMeetings();
  }, []);

  const handleMeetingPress = (meetingId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/meeting/${meetingId}`);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return 'Data necunoscută';
    }
  };

  const groupByVertical = (): GroupedMeetings[] => {
    const grouped: Record<string, Meeting[]> = {};
    
    meetings.forEach((meeting) => {
      const vertical = meeting.vertical_type || 'GAL';
      if (!grouped[vertical]) {
        grouped[vertical] = [];
      }
      grouped[vertical].push(meeting);
    });

    return Object.entries(grouped).map(([vertical, meetings]) => ({
      vertical,
      meetings,
    }));
  };

  const renderMeetingItem = ({ item }: { item: Meeting }) => {
    const verticalColor = VERTICAL_COLORS[item.vertical_type || 'GAL'];
    const statusColor = STATUS_COLORS[item.status] || '#6B7280';

    return (
      <Pressable
        onPress={() => handleMeetingPress(item._id)}
        className="bg-white rounded-xl p-4 mb-3 active:bg-gray-50"
        style={{
          borderLeftWidth: 4,
          borderLeftColor: verticalColor,
        }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-navy text-base font-heading mb-1" numberOfLines={1}>
              {formatDate(item.created_at)}
              {item.locality ? ` | ${item.locality}` : ''}
            </Text>

            {item.title && (
              <Text className="text-gray-600 text-sm font-body mb-2" numberOfLines={2}>
                {item.title}
              </Text>
            )}

            <View className="flex-row items-center gap-2 flex-wrap">
              {/* Vertical badge */}
              <View
                className="px-2 py-1 rounded-md"
                style={{ backgroundColor: verticalColor + '20' }}
              >
                <Text
                  className="text-xs font-heading"
                  style={{ color: verticalColor }}
                >
                  {VERTICAL_LABELS[item.vertical_type || 'GAL']}
                </Text>
              </View>

              {/* Status badge */}
              <View
                className="px-2 py-1 rounded-md"
                style={{ backgroundColor: statusColor + '20' }}
              >
                <Text
                  className="text-xs font-body"
                  style={{ color: statusColor }}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>
          </View>

          <ChevronRight size={20} color={COLORS.navy} />
        </View>
      </Pressable>
    );
  };

  const renderVerticalSection = ({ item }: { item: GroupedMeetings }) => (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-3 px-4">
        <View
          className="h-8 w-8 rounded-lg items-center justify-center"
          style={{ backgroundColor: VERTICAL_COLORS[item.vertical] + '20' }}
        >
          <FolderOpen size={18} color={VERTICAL_COLORS[item.vertical]} />
        </View>
        <Text className="text-navy text-lg font-heading">
          {VERTICAL_LABELS[item.vertical]}
        </Text>
        <View
          className="h-6 px-2 rounded-full items-center justify-center"
          style={{ backgroundColor: COLORS.navy + '10' }}
        >
          <Text className="text-navy text-xs font-heading">
            {item.meetings.length}
          </Text>
        </View>
      </View>

      <View className="px-4">
        {item.meetings.map((meeting) => (
          <View key={meeting._id}>
            {renderMeetingItem({ item: meeting })}
          </View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-ivory">
        <TopBar />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text className="text-navy font-body mt-4">Se încarcă întâlnirile...</Text>
        </View>
      </View>
    );
  }

  const groupedData = groupByVertical();

  if (groupedData.length === 0) {
    return (
      <View className="flex-1 bg-ivory">
        <TopBar />
        <View className="flex-1 justify-center items-center px-6">
          <View
            className="h-20 w-20 rounded-2xl items-center justify-center mb-4"
            style={{ backgroundColor: COLORS.navy + '10' }}
          >
            <FolderOpen size={40} color={COLORS.navy} />
          </View>
          <Text className="text-navy text-xl font-heading mb-2 text-center">
            Nicio întâlnire încă
          </Text>
          <Text className="text-gray-600 text-base font-body text-center">
            Înregistrează sau încarcă prima ta întâlnire din ecranul Acasă
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ivory">
      <TopBar />
      <FlatList
        data={groupedData}
        renderItem={renderVerticalSection}
        keyExtractor={(item) => item.vertical}
        contentContainerStyle={{ paddingVertical: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.navy}
            colors={[COLORS.navy]}
          />
        }
      />
    </View>
  );
}
