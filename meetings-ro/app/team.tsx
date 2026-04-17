import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert,
  StyleSheet, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, Users, Crown, Mail, UserPlus, ChevronDown,
  Trash2, Shield, CheckCircle2,
} from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';
import { useAuth } from '../src/context/AuthContext';

const ROLES = ['member', 'secretary', 'mayor', 'councilor', 'clerk', 'admin'] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<Role, string> = {
  member: 'Membru',
  secretary: 'Secretar',
  mayor: 'Primar',
  councilor: 'Consilier',
  clerk: 'Funcționar',
  admin: 'Administrator',
};

const ROLE_COLORS: Record<Role, string> = {
  member: '#6B7280',
  secretary: '#2563EB',
  mayor: '#7C3AED',
  councilor: '#047857',
  clerk: '#B45309',
  admin: '#DC2626',
};

export default function TeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [members, setMembers] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tenantRes, membersRes, invitesRes] = await Promise.all([
        authenticatedFetch(`${API_BASE_URL}/api/tenants/me`),
        authenticatedFetch(`${API_BASE_URL}/api/tenants/me/members`),
        isAdmin ? authenticatedFetch(`${API_BASE_URL}/api/tenants/me/invitations`) : Promise.resolve(null),
      ]);
      if (tenantRes.ok) setTenant(await tenantRes.json());
      if (membersRes.ok) {
        const d = await membersRes.json();
        setMembers(d.members || []);
      }
      if (invitesRes?.ok) {
        const d = await invitesRes.json();
        setInvitations(d.invitations || []);
      }
    } catch (e) {
      console.error('[Team]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/tenants/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('✓ Invitație trimisă', `Email trimis la ${inviteEmail}`);
        setInviteEmail('');
        setShowInvite(false);
        loadData(true);
      } else {
        Alert.alert('Eroare', data.detail || 'Nu am putut trimite invitația');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea la internet');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: Role) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setMembers(prev => prev.map(m => m._id === userId ? { ...m, role: newRole } : m));
        setExpandedMember(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const d = await res.json();
        Alert.alert('Eroare', d.detail || 'Nu am putut schimba rolul');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea');
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      'Elimină membrul',
      `Ești sigur că vrei să elimini ${member.name} din organizație? Contul său va rămâne activ, dar nu va mai vedea ședințele organizației.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Elimină',
          style: 'destructive',
          onPress: async () => {
            try {
              await authenticatedFetch(`${API_BASE_URL}/api/tenants/me/members/${member._id}`, { method: 'DELETE' });
              loadData(true);
            } catch { Alert.alert('Eroare', 'Nu am putut elimina membrul'); }
          },
        },
      ]
    );
  };

  const handleRevokeInvite = async (token: string) => {
    await authenticatedFetch(`${API_BASE_URL}/api/tenants/me/invitations/${token}`, { method: 'DELETE' });
    loadData(true);
  };

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.topbar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color={COLORS.navy} />
          </Pressable>
          <Text style={s.topbarTitle}>Echipa mea</Text>
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.navy} /></View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Topbar */}
      <View style={s.topbar}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={COLORS.navy} />
        </Pressable>
        <Text style={s.topbarTitle}>Echipa mea</Text>
        {isAdmin && (
          <Pressable
            style={s.inviteTopBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInvite(!showInvite); }}
          >
            <UserPlus size={18} color="#FAF8F3" />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.navy} />}
      >
        {/* Tenant card */}
        {tenant && (
          <View style={s.tenantCard}>
            <View style={s.tenantCardTop}>
              <View style={s.tenantIcon}>
                <Crown size={20} color={COLORS.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tenantName}>{tenant.name}</Text>
                <Text style={s.tenantMeta}>
                  {tenant.type === 'primarie' ? 'Primărie / Consiliu'
                    : tenant.type === 'ong' ? 'ONG / Asociație'
                    : tenant.type === 'firma' ? 'Firmă / Companie'
                    : tenant.type === 'spital' ? 'Spital / Clinică'
                    : tenant.type === 'scoala' ? 'Școală / Universitate'
                    : 'Organizație'} · Plan {(tenant.plan || 'free').toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={s.tenantStats}>
              <View style={s.tenantStat}>
                <Text style={s.tenantStatVal}>{members.length}</Text>
                <Text style={s.tenantStatLabel}>Membri</Text>
              </View>
              <View style={s.tenantStat}>
                <Text style={s.tenantStatVal}>{invitations.length}</Text>
                <Text style={s.tenantStatLabel}>Invitații pending</Text>
              </View>
              <View style={s.tenantStat}>
                <Text style={s.tenantStatVal}>{tenant.vertical || 'GENERAL'}</Text>
                <Text style={s.tenantStatLabel}>Domeniu</Text>
              </View>
            </View>
          </View>
        )}

        {/* Invite form */}
        {isAdmin && showInvite && (
          <View style={s.inviteCard}>
            <Text style={s.inviteCardTitle}>Invită un coleg</Text>

            <Text style={s.fieldLabel}>Adresă email</Text>
            <View style={s.inputRow}>
              <Mail size={16} color="#9CA3AF" />
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="coleg@organizatie.ro"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                style={s.textInput}
              />
            </View>

            <Text style={s.fieldLabel}>Rol în organizație</Text>
            <View style={s.roleGrid}>
              {ROLES.map(r => (
                <Pressable
                  key={r}
                  style={[s.roleChip, inviteRole === r && { backgroundColor: COLORS.navy, borderColor: COLORS.navy }]}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={[s.roleChipText, inviteRole === r && { color: '#FAF8F3' }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={s.sendBtn} onPress={handleInvite} disabled={inviteLoading}>
              {inviteLoading
                ? <ActivityIndicator color="#FAF8F3" size={18} />
                : <><UserPlus size={16} color="#FAF8F3" /><Text style={s.sendBtnText}>Trimite invitația</Text></>
              }
            </Pressable>
          </View>
        )}

        {/* Pending invitations */}
        {isAdmin && invitations.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Invitații în așteptare ({invitations.length})</Text>
            {invitations.map(inv => (
              <View key={inv.token} style={s.inviteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inviteEmail}>{inv.email}</Text>
                  <Text style={s.inviteRole}>{ROLE_LABELS[inv.role as Role] || inv.role}</Text>
                </View>
                <Pressable onPress={() => handleRevokeInvite(inv.token)} style={s.revokeBtn}>
                  <Trash2 size={14} color="#EF4444" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Members list */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Membri ({members.length})</Text>
          {members.map(member => {
            const isMe = member._id === user?._id || member.email === user?.email;
            const isExpanded = expandedMember === member._id;
            const roleColor = ROLE_COLORS[member.role as Role] || '#6B7280';

            return (
              <View key={member._id} style={s.memberCard}>
                <Pressable
                  style={s.memberRow}
                  onPress={() => isAdmin && !isMe && setExpandedMember(isExpanded ? null : member._id)}
                >
                  <View style={s.memberAvatar}>
                    <Text style={s.memberAvatarText}>
                      {member.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.memberName}>{member.name}{isMe ? ' (tu)' : ''}</Text>
                      {member.role === 'admin' && <Shield size={12} color="#DC2626" />}
                    </View>
                    <Text style={s.memberEmail}>{member.email}</Text>
                  </View>
                  <View style={[s.rolePill, { backgroundColor: roleColor + '18' }]}>
                    <Text style={[s.rolePillText, { color: roleColor }]}>
                      {ROLE_LABELS[member.role as Role] || member.role}
                    </Text>
                  </View>
                  {isAdmin && !isMe && (
                    <ChevronDown
                      size={16}
                      color="#9CA3AF"
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                    />
                  )}
                </Pressable>

                {/* Role picker (expanded) */}
                {isAdmin && !isMe && isExpanded && (
                  <View style={s.roleExpanded}>
                    <Text style={s.roleExpandedLabel}>Schimbă rolul:</Text>
                    <View style={s.roleGrid}>
                      {ROLES.map(r => (
                        <Pressable
                          key={r}
                          style={[
                            s.roleChip,
                            member.role === r && { backgroundColor: COLORS.navy, borderColor: COLORS.navy }
                          ]}
                          onPress={() => handleChangeRole(member._id, r)}
                        >
                          {member.role === r && <CheckCircle2 size={11} color="#FAF8F3" />}
                          <Text style={[s.roleChipText, member.role === r && { color: '#FAF8F3' }]}>
                            {ROLE_LABELS[r]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={s.removeBtn} onPress={() => handleRemoveMember(member)}>
                      <Trash2 size={14} color="#EF4444" />
                      <Text style={s.removeBtnText}>Elimină din organizație</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF8F3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    height: 56, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAF8F3',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  topbarTitle: {
    flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.navy,
    fontFamily: 'PlayfairDisplay_700Bold', marginLeft: 8,
  },
  inviteTopBtn: {
    width: 36, height: 36, backgroundColor: COLORS.navy,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Tenant card
  tenantCard: {
    backgroundColor: COLORS.navy, borderRadius: 16, padding: 20, marginBottom: 16,
  },
  tenantCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  tenantIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  tenantName: { fontSize: 17, fontWeight: '700', color: '#FAF8F3' },
  tenantMeta: { fontSize: 12, color: 'rgba(250,248,243,0.5)', marginTop: 2 },
  tenantStats: { flexDirection: 'row', gap: 0 },
  tenantStat: { flex: 1, alignItems: 'center' },
  tenantStatVal: { fontSize: 20, fontWeight: '700', color: '#FAF8F3' },
  tenantStatLabel: { fontSize: 10, color: 'rgba(250,248,243,0.5)', marginTop: 2 },

  // Invite card
  inviteCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  inviteCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, height: 46,
  },
  textInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.navy },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  roleChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.navy, borderRadius: 10,
    paddingVertical: 12, marginTop: 14,
  },
  sendBtnText: { color: '#FAF8F3', fontWeight: '700', fontSize: 14 },

  // Pending invitations
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.navy, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9EC',
    borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  inviteEmail: { fontSize: 13, fontWeight: '600', color: COLORS.navy },
  inviteRole: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  revokeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Member cards
  memberCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.navy + '18', alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  memberName: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  memberEmail: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolePillText: { fontSize: 11, fontWeight: '600' },

  // Role expanded
  roleExpanded: {
    paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA',
  },
  roleExpandedLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 8, fontWeight: '600' },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#FEF2F2', alignSelf: 'flex-start',
  },
  removeBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
});
