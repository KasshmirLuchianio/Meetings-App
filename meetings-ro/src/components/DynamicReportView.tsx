import React, { useState, useEffect, useRef } from 'react';
import {
  View, ScrollView, Text, Pressable, ActivityIndicator,
  RefreshControl, Alert, StyleSheet, Modal, TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import {
  RefreshCw, Download, FileText, Sparkles, Users,
  MapPin, Calendar, Clock, ChevronDown, CheckCircle2, AlertTriangle, Scroll,
  MoreVertical, Edit3, Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../constants/config';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import TopBar from '../components/TopBar';
import { COLORS } from '../constants/theme';

// ── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'In asteptare',  color: '#92400E', bg: '#FEF3C7' },
  uploading:    { label: 'Se incarca',    color: '#1E40AF', bg: '#DBEAFE' },
  transcribing: { label: 'Transcriere',   color: '#6D28D9', bg: '#EDE9FE' },
  processing:   { label: 'Procesare AI',  color: '#047857', bg: '#D1FAE5' },
  processed:    { label: 'Finalizat',     color: '#065F46', bg: '#D1FAE5' },
  done:         { label: 'Finalizat',     color: '#065F46', bg: '#D1FAE5' },
  failed:       { label: 'Esuat',         color: '#991B1B', bg: '#FEE2E2' },
  error:        { label: 'Eroare',        color: '#991B1B', bg: '#FEE2E2' },
};


const FINAL_STATUSES = ['processed', 'done', 'failed', 'error'];

// ── Section component ──────────────────────────────────────
function ReportSection({ title, icon, children, noPadding }: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        {icon}
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.sectionLine} />
      </View>
      <View style={noPadding ? undefined : s.sectionBody}>
        {children}
      </View>
    </View>
  );
}

// ── Field row ──────────────────────────────────────────────
function FieldRow({ label, value }: { label: string; value: any }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  if (Array.isArray(value)) {
    return (
      <View style={s.fieldContainer}>
        <Text style={s.fieldLabel}>{label}</Text>
        {value.map((item: any, i: number) => (
          <View key={i} style={s.listItem}>
            <View style={s.bullet} />
            <Text style={s.listText}>
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={s.fieldContainer}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{String(value)}</Text>
    </View>
  );
}

// ── Speaker colors ─────────────────────────────────────────
const SPEAKER_COLORS = [
  { bg: '#EFF6FF', accent: '#2563EB', text: '#1E40AF' },
  { bg: '#FEF3C7', accent: '#D97706', text: '#92400E' },
  { bg: '#F0FDF4', accent: '#16A34A', text: '#166534' },
  { bg: '#FDF2F8', accent: '#DB2777', text: '#9D174D' },
  { bg: '#EDE9FE', accent: '#7C3AED', text: '#5B21B6' },
  { bg: '#FFF7ED', accent: '#EA580C', text: '#9A3412' },
  { bg: '#F0FDFA', accent: '#0D9488', text: '#115E59' },
  { bg: '#FEF2F2', accent: '#DC2626', text: '#991B1B' },
];

function getSpeakerColor(speakerName: string, speakerMap: Map<string, number>) {
  if (!speakerMap.has(speakerName)) {
    speakerMap.set(speakerName, speakerMap.size);
  }
  return SPEAKER_COLORS[speakerMap.get(speakerName)! % SPEAKER_COLORS.length];
}

interface DiarizedEntry {
  speaker: string;
  role?: string | null;
  timestamp?: string;
  text: string;
}

// ── Main component ─────────────────────────────────────────
export default function DynamicReportView({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const [meeting, setMeeting] = useState<any>(null);
  const [verticalConfig, setVerticalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'docx' | 'pv' | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Rename / Delete modal
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // ── Data loading ───────────────────────────────────────
  useEffect(() => {
    if (meetingId) loadMeetingData();
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (meeting && !FINAL_STATUSES.includes(meeting.status)) {
      pollingRef.current = setInterval(() => loadMeetingData(true), 5000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [meetingId, meeting?.status]);

  const safeFetchJson = async (url: string) => {
    const res = await authenticatedFetch(url);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`Server error: ${res.status}`); }
  };

  const loadMeetingData = async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setLoadError(''); }
      const data = await safeFetchJson(`${API_BASE_URL}/api/meetings/${meetingId}`);
      setMeeting(data);
      try {
        const vData = await safeFetchJson(`${API_BASE_URL}/api/v1/verticals`);
        setVerticalConfig(vData.verticals?.find((v: any) => v.name === (data.vertical_type || 'GAL')));
      } catch {}
    } catch (e: any) {
      setLoadError(e.message || 'Eroare la incarcare');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Actions ────────────────────────────────────────────
  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    loadMeetingData(false);
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'pv') => {
    if (!meeting || !FINAL_STATUSES.slice(0, 2).includes(meeting.status)) {
      Alert.alert('Export indisponibil', 'Disponibil doar pentru intalniri finalizate.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(format);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) { Alert.alert('Eroare', 'Sharing nu e disponibil.'); return; }

      const endpoint = format === 'pv' ? 'export/proces-verbal' : `export/${format}`;
      const fileExt = format === 'pv' ? 'docx' : format;
      const filePrefix = format === 'pv' ? 'proces_verbal' : 'meeting';

      const url = `${API_BASE_URL}/api/meetings/${meetingId}/${endpoint}`;
      const fileUri = FileSystem.cacheDirectory + `${filePrefix}_${meetingId}.${fileExt}`;
      const authToken = await SecureStore.getItemAsync('auth_token');
      const dl = await FileSystem.downloadAsync(url, fileUri, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (dl.status !== 200) throw new Error('Download failed');
      await Sharing.shareAsync(dl.uri, {
        mimeType: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: format === 'pv'
          ? `Proces-Verbal — ${meeting.title || 'Sedinta'}`
          : `${meeting.title || 'Raport'} — ${format.toUpperCase()}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Eroare export', 'Nu am putut exporta fisierul.');
    } finally {
      setExporting(null);
    }
  };

  // ── Meeting options (rename / delete) ──────────────────────
  const handleMeetingOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Opțiuni înregistrare',
      '',
      [
        { text: 'Redenumește', onPress: openRenameModal },
        { text: 'Șterge înregistrarea', style: 'destructive', onPress: confirmDelete },
        { text: 'Anulează', style: 'cancel' },
      ]
    );
  };

  const openRenameModal = () => {
    setRenameValue(meeting?.title || '');
    setRenameModal(true);
  };

  const submitRename = async () => {
    if (!renameValue.trim()) return;
    setRenameLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (res.ok) {
        setRenameModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await loadMeetingData(true);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Eroare', err.detail || 'Nu am putut redenumi înregistrarea.');
      }
    } catch {
      Alert.alert('Eroare', 'Verifică conexiunea la internet.');
    } finally {
      setRenameLoading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Șterge înregistrarea',
      'Această acțiune este ireversibilă. Înregistrarea și raportul vor fi șterse definitiv.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await authenticatedFetch(`${API_BASE_URL}/api/meetings/${meetingId}`, { method: 'DELETE' });
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }
            } catch {
              Alert.alert('Eroare', 'Nu am putut șterge înregistrarea.');
            }
          },
        },
      ]
    );
  };

  const handleCorrectTranscript = () => {
    Alert.alert(
      'Corectare AI',
      'Transcrierea va fi corectata automat (gramatica, diacritice, punctuatie) si raportul va fi regenerat.\n\nContinui?',
      [
        { text: 'Anuleaza', style: 'cancel' },
        {
          text: 'Da, corecteaza',
          onPress: async () => {
            setIsCorrecting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const res = await authenticatedFetch(
                `${API_BASE_URL}/api/meetings/${meetingId}/correct-transcript`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' } },
              );
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Eroare');
              }
              await loadMeetingData();
            } catch (e: any) {
              Alert.alert('Eroare', e.message);
            } finally {
              setIsCorrecting(false);
            }
          },
        },
      ]
    );
  };

  // ── Loading / Error states ─────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8F6F0', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        <Text style={{ color: '#9CA3AF', marginTop: 12, fontSize: 14 }}>Se incarca raportul...</Text>
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
        <TopBar showBack />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <AlertTriangle size={48} color="#EF4444" />
          <Text style={{ color: COLORS.navy, fontSize: 20, fontWeight: '700', marginTop: 16 }}>
            Intalnire negasita
          </Text>
          <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
            {loadError || 'Nu am putut incarca detaliile.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Derived data ───────────────────────────────────────
  const status = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.pending;
  const isProcessing = !FINAL_STATUSES.includes(meeting.status);
  const isDone = meeting.status === 'processed' || meeting.status === 'done';
  const isFailed = meeting.status === 'failed' || meeting.status === 'error';
  const verticalType = meeting.vertical_type || 'GAL';

  const formatDate = (d: string) => {
    try {
      const date = new Date(d);
      const months = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch { return ''; }
  };

  const formatTime = (d: string) => {
    try {
      const date = new Date(d);
      return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    } catch { return ''; }
  };

  // ── Check if report has content ─────────────────────────
  const hasReportContent = !!(meeting.vertical_config && Object.keys(meeting.vertical_config).length > 0);

  // ── Diarized transcript ─────────────────────────────────
  const diarized: DiarizedEntry[] = meeting.diarized_transcript || [];
  const DIARIZED_PREVIEW_COUNT = 8;
  const displayDiarized = transcriptExpanded
    ? diarized
    : diarized.slice(0, DIARIZED_PREVIEW_COUNT);

  // Build speaker color map
  const speakerColorMap = new Map<string, number>();
  diarized.forEach((entry: DiarizedEntry) => {
    if (!speakerColorMap.has(entry.speaker)) {
      speakerColorMap.set(entry.speaker, speakerColorMap.size);
    }
  });
  const speakerCount = speakerColorMap.size;

  // ── Raw transcript fallback ────────────────────────────
  const transcript = meeting.transcript || '';
  const PREVIEW_LENGTH = 500;
  const needsTruncation = transcript.length > PREVIEW_LENGTH;
  const displayTranscript = transcriptExpanded
    ? transcript
    : transcript.substring(0, PREVIEW_LENGTH) + (needsTruncation ? '...' : '');

  // ── Render ─────────────────────────────────────────────
  const optionsButton = (
    <Pressable
      onPress={handleMeetingOptions}
      style={{ height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }}
    >
      <MoreVertical size={22} stroke={COLORS.navy} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
      <TopBar showBack rightComponent={optionsButton} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.navy} />
        }
      >
        {/* ── DOCUMENT HEADER ── */}
        <View style={s.docHeader}>
          {/* Title */}
          <Text style={s.docTitle}>
            {meeting.title || 'Raport intalnire'}
          </Text>

          {/* Meta row */}
          <View style={s.metaRow}>
            {meeting.created_at && (
              <>
                <View style={s.metaItem}>
                  <Calendar size={13} color="#9CA3AF" />
                  <Text style={s.metaText}>{formatDate(meeting.created_at)}</Text>
                </View>
                <View style={s.metaItem}>
                  <Clock size={13} color="#9CA3AF" />
                  <Text style={s.metaText}>{formatTime(meeting.created_at)}</Text>
                </View>
              </>
            )}
            {meeting.locality && (
              <View style={s.metaItem}>
                <MapPin size={13} color="#9CA3AF" />
                <Text style={s.metaText}>{meeting.locality}</Text>
              </View>
            )}
          </View>

          {/* Status pill */}
          <View style={[s.statusPill, { backgroundColor: status.bg }]}>
            {isProcessing ? (
              <ActivityIndicator size={12} color={status.color} />
            ) : isDone ? (
              <CheckCircle2 size={14} color={status.color} />
            ) : isFailed ? (
              <AlertTriangle size={14} color={status.color} />
            ) : null}
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* ── PROCESSING BANNER ── */}
        {isProcessing && (
          <View style={s.banner}>
            <View style={s.bannerDot} />
            <Text style={s.bannerText}>
              Procesare in curs — raportul se actualizeaza automat
            </Text>
          </View>
        )}

        {/* ── ERROR BANNER ── */}
        {isFailed && meeting.error && (
          <View style={[s.banner, { backgroundColor: '#FEF2F2', marginHorizontal: 16 }]}>
            <AlertTriangle size={16} color="#DC2626" />
            <Text style={[s.bannerText, { color: '#991B1B' }]}>{meeting.error}</Text>
          </View>
        )}

        {/* ── EXPORT & REPORT CARD ── */}
        {isDone && (
          <View style={s.reportContainer}>
            {/* Decorative top line */}
            <View style={s.reportTopLine} />

            {/* Export buttons inside card */}
            <View style={s.exportInCard}>
              <Text style={s.exportInCardLabel}>Exporta raportul</Text>
              <View style={s.exportRow}>
                <Pressable
                  onPress={() => handleExport('pdf')}
                  disabled={exporting !== null}
                  style={[s.exportBtn, s.exportBtnPdf]}
                >
                  {exporting === 'pdf' ? (
                    <ActivityIndicator size={18} color="#FFFFFF" />
                  ) : (
                    <Download size={18} color="#FFFFFF" />
                  )}
                  <Text style={s.exportBtnTextPdf}>
                    {exporting === 'pdf' ? 'Se exporta...' : 'Descarca PDF'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleExport('docx')}
                  disabled={exporting !== null}
                  style={[s.exportBtn, s.exportBtnDocx]}
                >
                  {exporting === 'docx' ? (
                    <ActivityIndicator size={18} color={COLORS.navy} />
                  ) : (
                    <FileText size={18} color={COLORS.navy} />
                  )}
                  <Text style={s.exportBtnTextDocx}>
                    {exporting === 'docx' ? 'Se exporta...' : 'Descarca DOCX'}
                  </Text>
                </Pressable>
              </View>

              {/* Proces Verbal — institutional format */}
              <Pressable
                onPress={() => handleExport('pv')}
                disabled={exporting !== null}
                style={s.procesVerbalBtn}
              >
                {exporting === 'pv' ? (
                  <ActivityIndicator size={16} color={COLORS.gold} />
                ) : (
                  <Scroll size={16} color={COLORS.gold} />
                )}
                <Text style={s.procesVerbalText}>
                  {exporting === 'pv' ? 'Se genereaza...' : 'Genereaza Proces-Verbal'}
                </Text>
              </Pressable>
            </View>

            {/* Report content — if any extracted data exists */}
            {hasReportContent && (
              <>
                {/* Structured fields from AI extraction */}
                {Object.entries(meeting.vertical_config || {}).map(([key, val]) => {
                  if (!val || (Array.isArray(val) && val.length === 0)) return null;
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                  return (
                    <ReportSection key={key} title={label} icon={<FileText size={15} color={COLORS.navy} />}>
                      {Array.isArray(val) ? (
                        val.map((item: any, i: number) => (
                          <View key={i} style={s.listItem}>
                            <View style={s.bullet} />
                            <Text style={s.listText}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={s.bodyText}>{String(val)}</Text>
                      )}
                    </ReportSection>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── DIARIZED TRANSCRIPT (speakers identified) ── */}
        {diarized.length > 0 && (
          <View style={s.transcriptContainer}>
            <View style={s.transcriptHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Users size={15} color={COLORS.navy} />
                <Text style={s.transcriptTitle}>Transcriere</Text>
              </View>
              <Text style={s.transcriptLength}>
                {speakerCount} {speakerCount === 1 ? 'vorbitor' : 'vorbitori'}
              </Text>
            </View>

            {/* Speaker legend */}
            <View style={s.speakerLegend}>
              {Array.from(speakerColorMap.entries()).map(([name, idx]) => {
                const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
                return (
                  <View key={name} style={[s.speakerChip, { backgroundColor: color.bg }]}>
                    <View style={[s.speakerDot, { backgroundColor: color.accent }]} />
                    <Text style={[s.speakerChipText, { color: color.text }]}>{name}</Text>
                  </View>
                );
              })}
            </View>

            {/* Dialogue */}
            {displayDiarized.map((entry: DiarizedEntry, i: number) => {
              const color = getSpeakerColor(entry.speaker, speakerColorMap);
              const prevSpeaker = i > 0 ? displayDiarized[i - 1].speaker : null;
              const isNewSpeaker = entry.speaker !== prevSpeaker;

              return (
                <View key={i} style={[s.dialogueEntry, !isNewSpeaker && { marginTop: 2 }]}>
                  {isNewSpeaker && (
                    <View style={s.speakerRow}>
                      <View style={[s.speakerIndicator, { backgroundColor: color.accent }]} />
                      <Text style={[s.speakerName, { color: color.text }]}>
                        {entry.speaker}
                      </Text>
                      {entry.role && (
                        <Text style={s.speakerRole}> — {entry.role}</Text>
                      )}
                      {entry.timestamp && (
                        <Text style={s.speakerTimestamp}>{entry.timestamp}</Text>
                      )}
                    </View>
                  )}
                  <View style={[s.dialogueBubble, { backgroundColor: color.bg, borderLeftColor: color.accent }]}>
                    <Text style={s.dialogueText}>{entry.text}</Text>
                  </View>
                </View>
              );
            })}

            {diarized.length > DIARIZED_PREVIEW_COUNT && (
              <Pressable
                onPress={() => setTranscriptExpanded(!transcriptExpanded)}
                style={s.expandButton}
              >
                <Text style={s.expandButtonText}>
                  {transcriptExpanded
                    ? 'Arata mai putin'
                    : `Citeste tot (${diarized.length - DIARIZED_PREVIEW_COUNT} replici ramase)`}
                </Text>
                <ChevronDown
                  size={16}
                  color={COLORS.navy}
                  style={transcriptExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* ── RAW TRANSCRIPT (fallback if no diarization) ── */}
        {diarized.length === 0 && transcript.length > 0 && (
          <View style={s.transcriptContainer}>
            <View style={s.transcriptHeader}>
              <Text style={s.transcriptTitle}>Transcriere completa</Text>
              <Text style={s.transcriptLength}>
                {transcript.split(/\s+/).length} cuvinte
              </Text>
            </View>

            <Text style={s.transcriptText}>{displayTranscript}</Text>

            {needsTruncation && (
              <Pressable
                onPress={() => setTranscriptExpanded(!transcriptExpanded)}
                style={s.expandButton}
              >
                <Text style={s.expandButtonText}>
                  {transcriptExpanded ? 'Arata mai putin' : 'Citeste tot'}
                </Text>
                <ChevronDown
                  size={16}
                  color={COLORS.navy}
                  style={transcriptExpanded ? { transform: [{ rotate: '180deg' }] } : undefined}
                />
              </Pressable>
            )}
          </View>
        )}

        {/* ── AI CORRECT BUTTON ── */}
        {isDone && transcript.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Pressable
              onPress={handleCorrectTranscript}
              disabled={isCorrecting}
              style={[s.correctButton, isCorrecting && { opacity: 0.6 }]}
            >
              {isCorrecting ? (
                <ActivityIndicator size={18} color="#FFFFFF" />
              ) : (
                <Sparkles size={18} color="#FFFFFF" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.correctButtonTitle}>
                  {isCorrecting ? 'Se corecteaza...' : 'Corecteaza cu AI'}
                </Text>
                <Text style={s.correctButtonSub}>
                  Gramatica, diacritice, punctuatie — regenereaza raportul
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Export buttons are now inside the report card above */}
      </ScrollView>

      {/* ── RENAME MODAL ── */}
      <Modal
        visible={renameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Edit3 size={20} color={COLORS.navy} />
              <Text style={s.modalTitle}>Redenumește înregistrarea</Text>
            </View>
            <TextInput
              style={s.modalInput}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Numele înregistrării"
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitRename}
            />
            <View style={s.modalBtnRow}>
              <Pressable
                style={s.modalCancelBtn}
                onPress={() => setRenameModal(false)}
              >
                <Text style={s.modalCancelText}>Anulează</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirmBtn, renameLoading && { opacity: 0.6 }]}
                onPress={submitRename}
                disabled={renameLoading}
              >
                {renameLoading ? (
                  <ActivityIndicator size={16} color="#FFFFFF" />
                ) : (
                  <Text style={s.modalConfirmText}>Salvează</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  // Document header
  docHeader: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 24,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  verticalBadge: {
    backgroundColor: COLORS.navy + '0D',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 16,
  },
  verticalBadgeText: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  docTitle: {
    color: COLORS.navy,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Banners
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  bannerText: {
    flex: 1,
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Report container
  reportContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reportTopLine: {
    height: 3,
    backgroundColor: COLORS.navy,
  },

  // Section
  section: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
  sectionBody: {
    paddingBottom: 8,
  },

  // Field
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldValue: {
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 22,
  },
  bodyText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.navy,
    marginTop: 8,
  },
  listText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },

  // Transcript
  transcriptContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  transcriptTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  transcriptLength: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  transcriptText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  expandButtonText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '600',
  },

  // Correct button
  correctButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  correctButtonTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  correctButtonSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },

  // Export inside card
  exportInCard: {
    padding: 20,
    paddingBottom: 16,
  },
  exportInCardLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  exportBtnPdf: {
    backgroundColor: COLORS.navy,
  },
  exportBtnDocx: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.navy + '30',
  },
  exportBtnTextPdf: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  exportBtnTextDocx: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  procesVerbalBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.gold + '12',
    borderWidth: 1,
    borderColor: COLORS.gold + '40',
  },
  procesVerbalText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Rename Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  modalTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Speaker diarization
  speakerLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  speakerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  speakerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  speakerChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dialogueEntry: {
    marginTop: 12,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  speakerIndicator: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '700',
  },
  speakerRole: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  speakerTimestamp: {
    fontSize: 11,
    color: '#D1D5DB',
    marginLeft: 'auto',
  },
  dialogueBubble: {
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 4,
  },
  dialogueText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 22,
  },
});
