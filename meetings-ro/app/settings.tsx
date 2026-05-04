import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';
import { useAuth } from '../src/context/AuthContext';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [keepAudio, setKeepAudio] = useState<boolean>(user?.keep_audio ?? false);
  const [saving, setSaving] = useState(false);

  const handleAudioRetentionChange = async (value: boolean) => {
    // Optimistic update
    setKeepAudio(value);
    setSaving(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/users/audio-retention`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keep_audio: value }),
      });
      if (!res.ok) {
        throw new Error('PATCH failed');
      }
      await refreshUser();
      if (value) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Fișiere audio păstrate',
          'Înregistrările audio vor fi păstrate pe server după procesare. Poți dezactiva oricând această opțiune.',
          [{ text: 'Înțeles' }],
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Revert
      setKeepAudio(!value);
      Alert.alert('Eroare', 'Nu am putut salva setarea. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={COLORS.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Setări</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* CONFIDENȚIALITATE Section */}
        <Text style={styles.sectionTitle}>CONFIDENȚIALITATE</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Păstrează fișierele audio</Text>
              <Text style={styles.rowDescription}>
                Implicit, fișierele audio sunt șterse imediat după procesare (conform GDPR).
                Activează pentru a le păstra pe server după transcriere.
              </Text>
            </View>
            <Switch
              value={keepAudio}
              onValueChange={handleAudioRetentionChange}
              disabled={saving}
              trackColor={{ false: '#D0CCC4', true: COLORS.navy }}
              thumbColor="#FAF8F3"
              ios_backgroundColor="#D0CCC4"
            />
          </View>

          {saving && (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={COLORS.navy} />
              <Text style={styles.savingText}>Se salvează...</Text>
            </View>
          )}
        </View>

        {keepAudio && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningEmoji}>⚠️</Text>
            <Text style={styles.warningText}>
              Fișierele audio sunt păstrate pe server. Dezactivează această opțiune pentru
              conformitate strictă GDPR.
            </Text>
          </View>
        )}

        {!keepAudio && (
          <View style={styles.infoBanner}>
            <ShieldCheck size={16} color="#10B981" />
            <Text style={styles.infoText}>
              Fișierele audio sunt șterse automat după procesare (GDPR-compliant).
            </Text>
          </View>
        )}

        {/* CONT Section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>CONT</Text>

        <View style={styles.card}>
          <View style={styles.staticRow}>
            <Text style={styles.staticLabel}>Email</Text>
            <Text style={styles.staticValue} numberOfLines={1}>
              {user?.email || '—'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.staticRow}>
            <Text style={styles.staticLabel}>Nume</Text>
            <Text style={styles.staticValue}>{user?.name || '—'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.staticRow}>
            <Text style={styles.staticLabel}>Plan</Text>
            <Text style={styles.staticValue}>{user?.plan || 'FREE'}</Text>
          </View>
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.navy,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.navy,
    marginBottom: 4,
    fontFamily: 'DMSans_600SemiBold',
  },
  rowDescription: {
    fontSize: 12,
    color: '#6B6560',
    lineHeight: 17,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  savingText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  warningEmoji: {
    fontSize: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    lineHeight: 17,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 17,
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  staticLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  staticValue: {
    fontSize: 14,
    color: COLORS.navy,
    fontWeight: '500',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
});
