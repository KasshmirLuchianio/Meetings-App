import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react-native';
import { Calendar } from 'react-native-calendars';
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

interface MarkedDates {
  [date: string]: {
    marked: boolean;
    dotColor: string;
    count?: number;
  };
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

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [monthCache, setMonthCache] = useState<Record<string, MarkedDates>>({});
  const [dayMeetings, setDayMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  useEffect(() => {
    fetchMonthDates(currentMonth.year, currentMonth.month);
    // Prefetch next month
    const nextMonth = currentMonth.month === 12 ? 1 : currentMonth.month + 1;
    const nextYear = currentMonth.month === 12 ? currentMonth.year + 1 : currentMonth.year;
    prefetchMonth(nextYear, nextMonth);
  }, [currentMonth]);

  useEffect(() => {
    fetchDayMeetings(selectedDate);
  }, [selectedDate]);

  const fetchMonthDates = async (year: number, month: number) => {
    // Check cache first
    const cacheKey = `${year}-${month}`;
    if (monthCache[cacheKey]) {
      setMarkedDates(monthCache[cacheKey]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/meetings/calendar-dates?year=${year}&month=${month}`
      );
      if (!response.ok) throw new Error('Failed to fetch calendar dates');

      const data = await response.json();
      const marked: MarkedDates = {};

      Object.entries(data.dates).forEach(([date, count]: [string, any]) => {
        marked[date] = {
          marked: true,
          dotColor: COLORS.navy,
          count: count as number,
        };
      });

      setMarkedDates(marked);
      
      // Update cache
      setMonthCache((prev) => ({
        ...prev,
        [cacheKey]: marked,
      }));
    } catch (error) {
      console.error('Fetch calendar dates error:', error);
    }
  };

  const prefetchMonth = async (year: number, month: number) => {
    const cacheKey = `${year}-${month}`;
    if (monthCache[cacheKey]) {
      return; // Already cached
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/meetings/calendar-dates?year=${year}&month=${month}`
      );
      if (!response.ok) return;

      const data = await response.json();
      const marked: MarkedDates = {};

      Object.entries(data.dates).forEach(([date, count]: [string, any]) => {
        marked[date] = {
          marked: true,
          dotColor: COLORS.navy,
          count: count as number,
        };
      });

      // Update cache silently
      setMonthCache((prev) => ({
        ...prev,
        [cacheKey]: marked,
      }));
    } catch (error) {
      console.error('Prefetch month error:', error);
    }
  };

  const fetchDayMeetings = async (date: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/meetings/calendar-by-date?date=${date}`
      );
      if (!response.ok) throw new Error('Failed to fetch day meetings');

      const data = await response.json();
      setDayMeetings(data.meetings || []);
    } catch (error) {
      console.error('Fetch day meetings error:', error);
      setDayMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(day.dateString);
  };

  const handleMonthChange = (month: any) => {
    setCurrentMonth({
      year: month.year,
      month: month.month,
    });
  };

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

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const renderMeetingItem = ({ item }: { item: Meeting }) => {
    const verticalColor = VERTICAL_COLORS[item.vertical_type || 'GAL'];

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
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-gray-500 text-sm font-body">
                {formatTime(item.created_at)}
              </Text>
              {item.locality && (
                <>
                  <Text className="text-gray-400">•</Text>
                  <Text className="text-gray-600 text-sm font-body">
                    {item.locality}
                  </Text>
                </>
              )}
            </View>

            {item.title && (
              <Text className="text-navy text-base font-heading mb-2" numberOfLines={2}>
                {item.title}
              </Text>
            )}

            <View
              className="px-2 py-1 rounded-md self-start"
              style={{ backgroundColor: verticalColor + '20' }}
            >
              <Text
                className="text-xs font-heading"
                style={{ color: verticalColor }}
              >
                {VERTICAL_LABELS[item.vertical_type || 'GAL']}
              </Text>
            </View>
          </View>

          <ChevronRight size={20} color={COLORS.navy} />
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-ivory">
      <TopBar />

      <ScrollView className="flex-1">
        {/* Calendar */}
        <View className="bg-white mx-4 mt-4 rounded-2xl overflow-hidden">
          <Calendar
            current={selectedDate}
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                ...markedDates[selectedDate],
                selected: true,
                selectedColor: COLORS.navy,
              },
            }}
            markingType="multi-dot"
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: COLORS.navy,
              selectedDayBackgroundColor: COLORS.navy,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: COLORS.navy,
              dayTextColor: '#1F2937',
              textDisabledColor: '#D1D5DB',
              dotColor: COLORS.navy,
              selectedDotColor: '#FFFFFF',
              arrowColor: COLORS.navy,
              monthTextColor: COLORS.navy,
              textDayFontFamily: 'DMSans_500Medium',
              textMonthFontFamily: 'PlayfairDisplay_700Bold',
              textDayHeaderFontFamily: 'DMSans_600SemiBold',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* Selected date label */}
        <View className="px-4 mt-6 mb-3">
          <Text className="text-navy text-lg font-heading">
            {formatDate(selectedDate)}
          </Text>
        </View>

        {/* Meetings list */}
        <View className="px-4 pb-6">
          {loading ? (
            <View className="bg-white rounded-xl p-8 items-center">
              <ActivityIndicator size="small" color={COLORS.navy} />
              <Text className="text-gray-600 font-body mt-2">Se încarcă...</Text>
            </View>
          ) : dayMeetings.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center">
              <View
                className="h-16 w-16 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: COLORS.navy + '10' }}
              >
                <CalendarIcon size={32} color={COLORS.navy} />
              </View>
              <Text className="text-navy text-base font-heading mb-1">
                Nicio întâlnire în această zi
              </Text>
              <Text className="text-gray-600 text-sm font-body text-center">
                Selectează altă zi sau înregistrează o întâlnire nouă
              </Text>
            </View>
          ) : (
            <FlatList
              data={dayMeetings}
              renderItem={renderMeetingItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
