import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Building2 } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';

const ORG_TYPES = [
  { id: 'primarie', label: '🏛️ Primărie / Consiliu' },
  { id: 'ong', label: '🤝 ONG / Asociație' },
  { id: 'firma', label: '🏢 Firmă / Companie' },
  { id: 'spital', label: '🏥 Spital / Clinică' },
  { id: 'scoala', label: '🎓 Școală / Universitate' },
  { id: 'other', label: '📋 Altele' },
];

const VERTICALS = [
  { id: 'GENERAL', label: '🌐 General' },
  { id: 'GAL', label: '🏛️ Administrație publică' },
  { id: 'LEGAL', label: '⚖️ Legal / Juridic' },
  { id: 'BANKING', label: '🏦 Banking / Finanțe' },
  { id: 'HEALTHCARE', label: '🏥 Sănătate' },
  { id: 'JOURNALISM', label: '📰 Jurnalism / Media' },
  { id: 'STARTUPS', label: '🚀 Startup / Tech' },
];

export default function CreateOrgScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [type, setType] = useState('primarie');
  const [vertical, setVertical] = useState('GENERAL');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Eroare', 'Introdu numele organizației');
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, vertical }),
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          '✓ Organizație creată',
          `„${name}" a fost creată. Ești acum administrator.`,
          [{ text: 'Continuă', onPress: () => router.replace('/team') }]
        );
      } else {
        Alert.alert('Eroare', data.detail || 'Nu am putut crea organizația');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea la internet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.navy} />
        </Pressable>
        <Text style={s.headerTitle}>Creează organizație</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Building2 size={28} color={COLORS.navy} />
          </View>
          <Text style={s.heroTitle}>Primul pas enterprise</Text>
          <Text style={s.heroSub}>
            Creează organizația ta. Poți invita colegi și gestionezi ședințele împreună.
          </Text>
        </View>

        {/* Org name */}
        <View style={s.field}>
          <Text style={s.label}>Numele organizației *</Text>
          <TextInput
            style={s.input}
            placeholder="ex: Primăria Cluj-Napoca"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
          />
        </View>

        {/* Org type */}
        <View style={s.field}>
          <Text style={s.label}>Tip organizație</Text>
          <View style={s.chipGrid}>
            {ORG_TYPES.map(t => (
              <Pressable
                key={t.id}
                style={[s.chip, type === t.id && s.chipActive]}
                onPress={() => setType(t.id)}
              >
                <Text style={[s.chipText, type === t.id && s.chipTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Vertical */}
        <View style={s.field}>
          <Text style={s.label}>Domeniu principal</Text>
          <Text style={s.labelSub}>Setează o singură dată — AI-ul va adapta rapoartele pentru domeniul tău</Text>
          <View style={s.chipGrid}>
            {VERTICALS.map(v => (
              <Pressable
                key={v.id}
                style={[s.chip, vertical === v.id && s.chipActive]}
                onPress={() => setVertical(v.id)}
              >
                <Text style={[s.chipText, vertical === v.id && s.chipTextActive]}>{v.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* CTA */}
        <Pressable style={[s.cta, loading && { opacity: 0.6 }]} onPress={handleCreate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#FAF8F3" />
            : <Text style={s.ctaText}>Creează organizația</Text>
          }
        </Pressable>

        <Text style={s.note}>
          Vei fi automat administratorul organizației. Poți invita colegi din ecranul „Echipa mea".
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F3' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    height: 56, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: {
    flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.navy,
    fontFamily: 'PlayfairDisplay_700Bold', marginLeft: 8,
  },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 28 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.navy + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: COLORS.navy, marginBottom: 6 },
  heroSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  labelSub: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, marginTop: -4 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: COLORS.navy,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  chipTextActive: { color: '#FAF8F3' },

  cta: {
    backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaText: { color: '#FAF8F3', fontSize: 16, fontWeight: '700' },

  note: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
