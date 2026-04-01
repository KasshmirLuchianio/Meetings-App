import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export default function DynamicReportView({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<any>(null);
  const [verticalConfig, setVerticalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    try {
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

  return (
    <View className="flex-1 bg-ivory">
      <TopBar onMenuPress={() => {}} />
      <ScrollView className="flex-1 px-4 py-4">
        {/* Meeting header */}
        <View className="mb-4">
          <Text className="text-navy text-2xl font-heading mb-1">{meeting.title || 'Fără titlu'}</Text>
          {meeting.locality && (
            <Text className="text-gray-600 font-body">📍 {meeting.locality}</Text>
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
