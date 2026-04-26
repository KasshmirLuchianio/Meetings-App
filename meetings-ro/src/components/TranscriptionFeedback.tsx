/**
 * TranscriptionFeedback
 *
 * Apple-level feedback micro-experience for transcription quality.
 *
 * Behavior:
 * - Appears after user has spent 30s on the screen (useEffect timer)
 * - Fades in smoothly from opacity 0
 * - Thumbs up → spring animation → saves → shows confirmation
 * - Thumbs down → reveals issue chips (no keyboard, no modal)
 * - Issue selected → saves → shows confirmation
 * - Once submitted: shows persisted state, allows one change
 * - If already rated (from API): shows current state immediately
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Issue chips shown on negative feedback — keep to max 4, one tap, done
const NEGATIVE_ISSUES = [
  { id: 'speakers', label: 'Vorbitori confundați' },
  { id: 'words',    label: 'Cuvinte greșite' },
  { id: 'missing',  label: 'Lipsesc fragmente' },
  { id: 'other',    label: 'Altceva' },
];

interface ExistingFeedback {
  rating: 1 | -1;
  issues?: string[];
}

interface Props {
  meetingId: string;
  existingFeedback?: ExistingFeedback | null;
  onFeedbackSubmit: (rating: 1 | -1, issues?: string[]) => Promise<void>;
}

type FeedbackState = 'hidden' | 'visible' | 'negative_detail' | 'submitted';

export default function TranscriptionFeedback({
  meetingId,
  existingFeedback,
  onFeedbackSubmit,
}: Props) {
  // ── State ────────────────────────────────────────────────────
  const [uiState, setUiState] = useState<FeedbackState>(
    existingFeedback ? 'submitted' : 'hidden'
  );
  const [selectedRating, setSelectedRating] = useState<1 | -1 | null>(
    existingFeedback?.rating ?? null
  );
  const [selectedIssues, setSelectedIssues] = useState<string[]>(
    existingFeedback?.issues ?? []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Animations ───────────────────────────────────────────────
  const containerOpacity = useRef(new Animated.Value(existingFeedback ? 1 : 0)).current;
  const thumbsUpScale    = useRef(new Animated.Value(1)).current;
  const thumbsDownScale  = useRef(new Animated.Value(1)).current;
  const issuesOpacity    = useRef(new Animated.Value(0)).current;
  const confirmOpacity   = useRef(new Animated.Value(existingFeedback ? 1 : 0)).current;

  // ── Appear after 30 seconds ──────────────────────────────────
  useEffect(() => {
    if (existingFeedback) {
      // Already rated — show immediately (values already initialised to 1)
      return;
    }

    const timer = setTimeout(() => {
      setUiState('visible');
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []);

  // ── Animate issue chips in ───────────────────────────────────
  useEffect(() => {
    if (uiState === 'negative_detail') {
      Animated.spring(issuesOpacity, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
    }
  }, [uiState]);

  // ── Spring animation on thumb tap ────────────────────────────
  const animateThumb = (scaleAnim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.82,
        useNativeDriver: true,
        tension: 200,
        friction: 5,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        useNativeDriver: true,
        tension: 200,
        friction: 5,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 6,
      }),
    ]).start();
  };

  // ── Handlers ─────────────────────────────────────────────────
  const handlePositive = async () => {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animateThumb(thumbsUpScale);
    setSelectedRating(1);
    setIsSubmitting(true);

    try {
      await onFeedbackSubmit(1, []);
      // Short delay so user sees the animation before confirmation
      setTimeout(() => {
        setUiState('submitted');
        Animated.timing(confirmOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 400);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegative = () => {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateThumb(thumbsDownScale);
    setSelectedRating(-1);
    setUiState('negative_detail');
  };

  const handleIssueSelect = async (issueId: string) => {
    if (isSubmitting) return;
    Haptics.selectionAsync();

    const newIssues = [issueId]; // single selection for simplicity
    setSelectedIssues(newIssues);
    setIsSubmitting(true);

    try {
      await onFeedbackSubmit(-1, newIssues);
      setTimeout(() => {
        setUiState('submitted');
        Animated.timing(confirmOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 300);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render nothing until timer fires ─────────────────────────
  if (uiState === 'hidden') return null;

  // ── Submitted state ──────────────────────────────────────────
  if (uiState === 'submitted') {
    return (
      <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
        <Animated.View style={[styles.confirmedRow, { opacity: confirmOpacity }]}>
          <Text style={styles.confirmedIcon}>
            {selectedRating === 1 ? '👍' : '👎'}
          </Text>
          <Text style={styles.confirmedText}>
            {selectedRating === 1
              ? 'Mulțumim! Feedback-ul tău îmbunătățește calitatea.'
              : 'Notăm. Vom îmbunătăți transcrierea.'}
          </Text>
        </Animated.View>
      </Animated.View>
    );
  }

  // ── Main feedback UI ─────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Question */}
      <Text style={styles.question}>
        {uiState === 'negative_detail'
          ? 'Ce a mers greșit?'
          : 'Transcrierea a fost corectă?'}
      </Text>

      {/* Thumbs row — only on initial view */}
      {uiState === 'visible' && (
        <View style={styles.thumbsRow}>

          <Animated.View style={{ transform: [{ scale: thumbsUpScale }] }}>
            <TouchableOpacity
              style={[styles.thumbButton, styles.thumbPositive]}
              onPress={handlePositive}
              activeOpacity={0.75}
            >
              <Text style={styles.thumbIcon}>👍</Text>
              <Text style={styles.thumbLabel}>Da, corectă</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: thumbsDownScale }] }}>
            <TouchableOpacity
              style={[styles.thumbButton, styles.thumbNegative]}
              onPress={handleNegative}
              activeOpacity={0.75}
            >
              <Text style={styles.thumbIcon}>👎</Text>
              <Text style={styles.thumbLabel}>A greșit</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      )}

      {/* Issue chips — shown only after thumbs down */}
      {uiState === 'negative_detail' && (
        <Animated.View style={[styles.chipsGrid, { opacity: issuesOpacity }]}>
          {NEGATIVE_ISSUES.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={[
                styles.chip,
                selectedIssues.includes(issue.id) && styles.chipSelected,
              ]}
              onPress={() => handleIssueSelect(issue.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipLabel,
                selectedIssues.includes(issue.id) && styles.chipLabelSelected,
              ]}>
                {issue.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Skip — only on first view, not on negative detail */}
      {uiState === 'visible' && (
        <TouchableOpacity
          onPress={() => setUiState('hidden')}
          style={styles.skipButton}
        >
          <Text style={styles.skipLabel}>Nu acum</Text>
        </TouchableOpacity>
      )}

    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    marginBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#D0CCC4',
    marginBottom: 20,
  },
  question: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1B2A4A',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100,   // pill shape
    borderWidth: 1.5,
  },
  thumbPositive: {
    borderColor: '#1B2A4A',
    backgroundColor: 'transparent',
  },
  thumbNegative: {
    borderColor: '#D0CCC4',
    backgroundColor: 'transparent',
  },
  thumbIcon: {
    fontSize: 18,
  },
  thumbLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1B2A4A',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#D0CCC4',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: '#1B2A4A',
    backgroundColor: '#1B2A4A',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1B2A4A',
  },
  chipLabelSelected: {
    color: '#FAF8F3',
  },
  skipButton: {
    marginTop: 16,
    padding: 8,
  },
  skipLabel: {
    fontSize: 13,
    color: '#A0998F',
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  confirmedIcon: {
    fontSize: 20,
  },
  confirmedText: {
    fontSize: 13,
    color: '#6B6560',
    flex: 1,
    lineHeight: 18,
  },
});
