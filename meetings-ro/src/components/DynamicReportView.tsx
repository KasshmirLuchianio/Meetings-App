import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Text, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RefreshCw, Download, FileText } from 'lucide-react-native';
import { API_BASE_URL } from '../constants/config';
import TopBar from '../components/TopBar';
import { COLORS } from '../constants/theme';

interface DynamicFieldProps {
  label: string;
  value: any;
  fieldType: string;
}

const DynamicField: React.FC<DynamicFieldProps> = ({ label, value, fieldType }) => {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  const renderValue = () => {
    if (fieldType === 'list') {
      return (
        <View className="space-y-2">
          {Array.isArray(value) ? (
            value.map((item: any, i: number) => (
              <View key={i} className="flex-row gap-2">
                <Text className="text-navy">•</Text>
                <Text className="flex-1 text-gray-700 font-body">
                  {typeof item === 'object' ? JSON.stringify(item) : item}
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-gray-700 font-body">{String(value)}</Text>
          )}
        </View>
      );
    }

    return <Text className="text-gray-700 font-body leading-relaxed">{String(value)}</Text>;
  };

  return (
    <View className="bg-white p-4 rounded-2xl mb-3">
      <Text className="text-xs uppercase text-gray-500 font-body mb-2">{label}</Text>
      {renderValue()}
    </View>
  );
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

export default function DynamicReportView({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<any>(null);
  const [verticalConfig, setVerticalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMeetingData();
    
    // Start polling if status is not final
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [meetingId]);

  useEffect(() => {
    // Start/stop polling based on status
    if (meeting && !['processed', 'failed'].includes(meeting.status)) {
      // Poll every 5 seconds for status updates
      pollingRef.current = setInterval(() => {
        loadMeetingData(true);
      }, 5000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [meeting?.status]);

  const loadMeetingData = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // Load meeting
      const meetingRes = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`);
      const meetingData = await meetingRes.json();
      setMeeting(meetingData);

      // Load vertical config
      const verticalType = meetingData.vertical_type || 'GAL';
      const verticalsRes = await fetch(`${API_BASE_URL}/api/v1/verticals`);
      const verticalsData = await verticalsRes.json();
      const config = verticalsData.verticals.find((v: any) => v.name === verticalType);
      setVerticalConfig(config);
    } catch (error) {
      console.error('Failed to load meeting:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadMeetingData(false);
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!meeting || meeting.status !== 'processed') {
      Alert.alert(
        'Export indisponibil',
        'Exportul este disponibil doar pentru întâlniri finalizate.'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(format);

    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Eroare', 'Sharing nu este disponibil pe acest device.');
        setExporting(null);
        return;
      }

      // Download file from backend
      const url = `${API_BASE_URL}/api/meetings/${meetingId}/export/${format}`;
      const fileUri = FileSystem.cacheDirectory + `meeting_${meetingId}.${format}`;

      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Download failed');
      }

      // Share file
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: `Export ${format.toUpperCase()} - ${meeting.title || 'Întâlnire'}`,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        'Eroare export',
        'Nu am putut exporta fișierul. Încearcă din nou mai târziu.'
      );
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-ivory justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View className="flex-1 bg-ivory">
        <TopBar onMenuPress={() => {}} />
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-navy text-xl font-heading mb-2">Întâlnire negăsită</Text>
          <Text className="text-gray-600 font-body text-center">
            Nu am putut încărca detaliile întâlnirii
          </Text>
        </View>
      </View>
    );
  }

  // Get vertical-specific output fields
  const verticalType = meeting.vertical_type || 'GAL';
  
  // Fallback to GAL fields for backward compatibility
  const renderFields = () => {
    if (verticalType === 'GAL') {
      return (
        <>
          <DynamicField label="Data desfășurare" value={meeting.data_desfasurare} fieldType="text" />
          <DynamicField label="Format întâlnire" value={meeting.format_intalnire} fieldType="text" />
          <DynamicField label="Loc desfășurare" value={meeting.loc_desfasurare} fieldType="text" />
          <DynamicField label="Mod promovare" value={meeting.mod_promovare} fieldType="text" />
          <DynamicField label="Obiectiv" value={meeting.obiectiv} fieldType="textarea" />
          <DynamicField label="Tematica" value={meeting.tematica} fieldType="textarea" />
          <DynamicField label="Scurtă descriere" value={meeting.scurta_descriere} fieldType="textarea" />
          <DynamicField label="Număr participanți" value={meeting.numar_participanti} fieldType="text" />
          <DynamicField label="Concluzia" value={meeting.concluzia} fieldType="textarea" />
        </>
      );
    }

    // For other verticals, use vertical_config
    const config = meeting.vertical_config || {};
    return Object.keys(config).map((key) => (
      <DynamicField
        key={key}
        label={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        value={config[key]}
        fieldType={Array.isArray(config[key]) ? 'list' : 'text'}
      />
    ));
  };

  const statusColor = STATUS_COLORS[meeting.status] || '#6B7280';
  const isProcessing = !['processed', 'failed'].includes(meeting.status);

  return (
    <View className="flex-1 bg-ivory">
      <TopBar />
      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.navy}
            colors={[COLORS.navy]}
          />
        }
      >
        {/* Meeting header */}
        <View className="mb-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text className="text-navy text-2xl font-heading mb-1">
                {meeting.title || 'Fără titlu'}
              </Text>
              {meeting.locality && (
                <Text className="text-gray-600 font-body">📍 {meeting.locality}</Text>
              )}
            </View>

            {/* Status badge */}
            <View
              className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5"
              style={{ backgroundColor: statusColor + '20' }}
            >
              {isProcessing && (
                <ActivityIndicator size="small" color={statusColor} />
              )}
              <Text className="text-xs font-heading" style={{ color: statusColor }}>
                {STATUS_LABELS[meeting.status] || meeting.status}
              </Text>
            </View>
          </View>

          {/* Processing indicator */}
          {isProcessing && (
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-row items-center gap-2 mb-4">
              <RefreshCw size={16} color="#3B82F6" />
              <Text className="text-blue-700 text-sm font-body flex-1">
                Procesare în curs... Pull-to-refresh pentru actualizare.
              </Text>
            </View>
          )}

          {/* Export buttons */}
          {meeting.status === 'processed' && (
            <View className="flex-row gap-2 mb-4">
              <Pressable
                onPress={() => handleExport('pdf')}
                disabled={exporting !== null}
                className="flex-1 bg-white border-2 rounded-xl p-3 flex-row items-center justify-center gap-2 active:bg-gray-50"
                style={{ borderColor: COLORS.navy }}
              >
                {exporting === 'pdf' ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <Download size={18} color={COLORS.navy} />
                )}
                <Text className="text-navy font-heading">
                  {exporting === 'pdf' ? 'Export...' : 'Export PDF'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleExport('docx')}
                disabled={exporting !== null}
                className="flex-1 bg-white border-2 rounded-xl p-3 flex-row items-center justify-center gap-2 active:bg-gray-50"
                style={{ borderColor: COLORS.navy }}
              >
                {exporting === 'docx' ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <FileText size={18} color={COLORS.navy} />
                )}
                <Text className="text-navy font-heading">
                  {exporting === 'docx' ? 'Export...' : 'Export DOCX'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Dynamic fields based on vertical */}
        {renderFields()}

        {/* Transcript */}
        {meeting.transcript && (
          <View className="bg-white p-4 rounded-2xl mt-2">
            <Text className="text-xs uppercase text-gray-500 font-body mb-2">
              Transcriere completă
            </Text>
            <Text className="text-gray-700 font-body leading-relaxed">{meeting.transcript}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
