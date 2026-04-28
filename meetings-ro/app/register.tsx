import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Linking, StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Building2, Check, X, Users } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';
import { API_BASE_URL } from '../src/constants/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ORG_TYPES = [
  { value: 'primarie', label: 'Primărie / Consiliu' },
  { value: 'ong', label: 'ONG / Asociație' },
  { value: 'firma', label: 'Firmă / Companie' },
  { value: 'spital', label: 'Spital / Clinică' },
  { value: 'scoala', label: 'Școală / Universitate' },
  { value: 'other', label: 'Altele' },
];

const ORG_VERTICALS = [
  { value: 'GENERAL', label: '🌐 General' },
  { value: 'GAL', label: '🏛️ Administrație publică' },
  { value: 'LEGAL', label: '⚖️ Legal / Juridic' },
  { value: 'BANKING', label: '🏦 Banking / Finanțe' },
  { value: 'HEALTHCARE', label: '🏥 Sănătate' },
  { value: 'JOURNALISM', label: '📰 Jurnalism / Media' },
  { value: 'STARTUPS', label: '🚀 Startup / Tech' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  // Personal fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Account type toggle
  const [accountType, setAccountType] = useState<'personal' | 'organization'>('personal');

  // Organization extra fields
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('primarie');
  const [orgVertical, setOrgVertical] = useState('GENERAL');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const allPasswordValid = passwordChecks.length && passwordChecks.uppercase && passwordChecks.digit && passwordChecks.symbol;

  const handleRegister = async () => {
    if (name.trim().length < 2) { setError('Numele trebuie să aibă minim 2 caractere'); return; }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Email invalid'); return; }
    if (!allPasswordValid) { setError('Parola nu îndeplinește toate cerințele'); return; }
    if (accountType === 'organization' && !orgName.trim()) {
      setError('Introdu numele organizației'); return;
    }

    setError('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await register(name.trim(), email.trim(), password, company.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // After registration, create tenant if organization flow
      if (accountType === 'organization' && orgName.trim()) {
        try {
          await authenticatedFetch(`${API_BASE_URL}/api/tenants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: orgName.trim(),
              type: orgType,
              vertical: orgVertical,
            }),
          });
        } catch (tenantErr) {
          // Tenant creation failed — user is registered but without tenant
          // Not a blocking error; they can create tenant later from settings
          console.warn('[Register] Tenant creation failed:', tenantErr);
        }
      }

      // Newly-registered users are unverified — drop straight onto the
      // verification screen. The Home redirect would do the same thing,
      // but going direct avoids a flicker.
      router.replace('/verify-email');
    } catch (err: any) {
      setError(err.message || 'Eroare la înregistrare. Încearcă din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRule = ({ met, label }: { met: boolean; label: string }) => (
    <View style={s.ruleRow}>
      {met ? <Check size={12} color="#22C55E" /> : <X size={12} color="#EF4444" />}
      <Text style={[s.ruleText, { color: met ? '#22C55E' : '#9CA3AF' }]}>{label}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={COLORS.navy} />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Creează cont</Text>
        <Text style={s.subtitle}>Începe cu 5 întâlniri gratuite pe lună</Text>

        {/* Account type toggle */}
        <View style={s.toggleContainer}>
          <Pressable
            style={[s.toggleBtn, accountType === 'personal' && s.toggleActive]}
            onPress={() => setAccountType('personal')}
          >
            <User size={15} color={accountType === 'personal' ? '#FAF8F3' : COLORS.navy} />
            <Text style={[s.toggleText, accountType === 'personal' && s.toggleTextActive]}>
              Cont personal
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, accountType === 'organization' && s.toggleActive]}
            onPress={() => setAccountType('organization')}
          >
            <Users size={15} color={accountType === 'organization' ? '#FAF8F3' : COLORS.navy} />
            <Text style={[s.toggleText, accountType === 'organization' && s.toggleTextActive]}>
              Organizație
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Name */}
        <View style={s.fieldWrap}>
          <Text style={s.label}>Nume complet *</Text>
          <View style={s.inputRow}>
            <User size={18} color="#9CA3AF" />
            <TextInput
              value={name} onChangeText={setName}
              placeholder="Ion Popescu" placeholderTextColor="#9CA3AF"
              autoCapitalize="words" style={s.input}
            />
          </View>
        </View>

        {/* Email */}
        <View style={s.fieldWrap}>
          <Text style={s.label}>Email *</Text>
          <View style={s.inputRow}>
            <Mail size={18} color="#9CA3AF" />
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="email@companie.ro" placeholderTextColor="#9CA3AF"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              style={s.input}
            />
          </View>
        </View>

        {/* Company (personal only) */}
        {accountType === 'personal' && (
          <View style={s.fieldWrap}>
            <Text style={s.label}>Companie (opțional)</Text>
            <View style={s.inputRow}>
              <Building2 size={18} color="#9CA3AF" />
              <TextInput
                value={company} onChangeText={setCompany}
                placeholder="Opțional" placeholderTextColor="#9CA3AF"
                style={s.input}
              />
            </View>
          </View>
        )}

        {/* Organization fields */}
        {accountType === 'organization' && (
          <View style={s.orgSection}>
            <Text style={s.orgSectionTitle}>Detalii organizație</Text>

            {/* Org Name */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Numele organizației *</Text>
              <View style={s.inputRow}>
                <Building2 size={18} color="#9CA3AF" />
                <TextInput
                  value={orgName} onChangeText={setOrgName}
                  placeholder="ex: Primăria Cluj-Napoca" placeholderTextColor="#9CA3AF"
                  style={s.input}
                />
              </View>
            </View>

            {/* Org Type */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Tip organizație</Text>
              <View style={s.chipGrid}>
                {ORG_TYPES.map(t => (
                  <Pressable
                    key={t.value}
                    style={[s.chip, orgType === t.value && s.chipActive]}
                    onPress={() => setOrgType(t.value)}
                  >
                    <Text style={[s.chipText, orgType === t.value && s.chipTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Org Vertical (domain) */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Domeniu principal</Text>
              <Text style={s.labelSub}>Setează o dată — toate ședințele vor folosi același format AI</Text>
              <View style={s.chipGrid}>
                {ORG_VERTICALS.map(v => (
                  <Pressable
                    key={v.value}
                    style={[s.chip, orgVertical === v.value && s.chipActive]}
                    onPress={() => setOrgVertical(v.value)}
                  >
                    <Text style={[s.chipText, orgVertical === v.value && s.chipTextActive]}>
                      {v.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Password */}
        <View style={s.fieldWrap}>
          <Text style={s.label}>Parolă *</Text>
          <View style={s.inputRow}>
            <Lock size={18} color="#9CA3AF" />
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="Minim 8 caractere" placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword} style={s.input}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
            </Pressable>
          </View>
          {password.length > 0 && (
            <View style={{ marginTop: 8, marginLeft: 2 }}>
              <PasswordRule met={passwordChecks.length} label="Minim 8 caractere" />
              <PasswordRule met={passwordChecks.uppercase} label="O literă mare (A-Z)" />
              <PasswordRule met={passwordChecks.digit} label="O cifră (0-9)" />
              <PasswordRule met={passwordChecks.symbol} label="Un simbol (!@#$%^&*)" />
            </View>
          )}
        </View>

        {/* CTA */}
        <Pressable onPress={handleRegister} disabled={isLoading} style={s.ctaBtn}>
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={s.ctaBtnText}>
              {accountType === 'organization' ? 'Creează organizație' : 'Creează cont gratuit'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/login')} style={s.loginLink}>
          <Text style={s.loginLinkText}>
            Ai deja cont? <Text style={{ color: COLORS.navy, fontWeight: '600' }}>Conectează-te</Text>
          </Text>
        </Pressable>

        <Text style={s.terms}>
          Prin crearea contului, accepți{' '}
          <Text style={s.termsLink} onPress={() => Linking.openURL('https://meetings-ro-api.onrender.com/terms')}>
            Termenii și Condițiile
          </Text>
          {' '}și{' '}
          <Text style={s.termsLink} onPress={() => Linking.openURL('https://meetings-ro-api.onrender.com/privacy')}>
            Politica de Confidențialitate
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F3' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.navy, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#9CA3AF', marginBottom: 24 },

  // Toggle
  toggleContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  toggleActive: { backgroundColor: COLORS.navy },
  toggleText: { fontSize: 13, fontWeight: '600', color: COLORS.navy },
  toggleTextActive: { color: '#FAF8F3' },

  // Error
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center' },

  // Fields
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.navy, marginBottom: 8 },
  labelSub: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, marginTop: -4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 56,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: COLORS.navy },

  // Organization section
  orgSection: {
    backgroundColor: '#F0F4FF', borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.navy + '20',
  },
  orgSectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.navy,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chipTextActive: { color: '#FAF8F3' },

  // CTA
  ctaBtn: {
    backgroundColor: COLORS.navy, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaBtnText: { color: '#FAF8F3', fontSize: 16, fontWeight: '700' },

  // Password rules
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ruleText: { fontSize: 12 },

  // Login link
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { color: '#9CA3AF', fontSize: 14 },

  // Terms
  terms: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  termsLink: { color: COLORS.navy, textDecorationLine: 'underline' },
});
