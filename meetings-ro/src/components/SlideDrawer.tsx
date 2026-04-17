import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Dimensions, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Home, FolderOpen, Calendar, X, Crown, LogOut, CreditCard, Trash2, Users } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { API_BASE_URL } from '../constants/config';
import { useDrawer } from '../context/DrawerContext';
import { useAuth } from '../context/AuthContext';
import { authenticatedFetch } from '../utils/authenticatedFetch';

const DRAWER_WIDTH = 280;

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: '#6B7280',
  PRO: COLORS.gold,
  ENTERPRISE: COLORS.navy,
};

export default function SlideDrawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Sync animation with isOpen state
  useEffect(() => {
    if (isOpen) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      // Immediately snap closed (no animation) to prevent ghost drawer
      translateX.setValue(-DRAWER_WIDTH);
    }
  }, [isOpen]);

  // Force closed position when auth state changes
  useEffect(() => {
    translateX.setValue(-DRAWER_WIDTH);
  }, [isAuthenticated]);

  const handleNavigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDrawer();
    setTimeout(() => router.navigate(route as any), 150);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeDrawer();
  };

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    closeDrawer();
    await logout();
    setTimeout(() => router.replace('/welcome'), 150);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Șterge contul',
      'Această acțiune este ireversibilă. Toate înregistrările și rapoartele tale vor fi șterse definitiv.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge definitiv',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/delete-account`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                throw new Error('Eroare la ștergere');
              }
              await SecureStore.deleteItemAsync('auth_token');
              closeDrawer();
              await logout();
              setTimeout(() => router.replace('/welcome'), 150);
            } catch {
              Alert.alert('Eroare', 'Nu am putut șterge contul. Încearcă din nou.');
            }
          },
        },
      ]
    );
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Overlay — only blocks touches when open */}
      {isOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998 }]}
          onPress={handleClose}
        />
      )}

      {/* Drawer */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[
          styles.drawer,
          { transform: [{ translateX }], paddingTop: insets.top },
        ]}
      >
        {/* User Profile Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={COLORS.navy} />
            </Pressable>
          </View>
          <Text style={styles.userName}>{user?.name || 'Utilizator'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={[styles.planBadge, { backgroundColor: `${PLAN_COLORS[user?.plan || 'FREE']}15` }]}>
            <Crown size={12} color={PLAN_COLORS[user?.plan || 'FREE']} />
            <Text style={[styles.planText, { color: PLAN_COLORS[user?.plan || 'FREE'] }]}>
              {PLAN_LABELS[user?.plan || 'FREE']}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          <Pressable onPress={() => handleNavigate('/')} style={styles.menuItem}>
            <Home size={20} color={COLORS.navy} />
            <Text style={styles.menuText}>Acasă</Text>
          </Pressable>

          <Pressable onPress={() => handleNavigate('/browse')} style={styles.menuItem}>
            <FolderOpen size={20} color={COLORS.navy} />
            <Text style={styles.menuText}>Întâlniri</Text>
          </Pressable>

          <Pressable onPress={() => handleNavigate('/calendar')} style={styles.menuItem}>
            <Calendar size={20} color={COLORS.navy} />
            <Text style={styles.menuText}>Calendar</Text>
          </Pressable>

          {user?.tenant_id && (
            <Pressable onPress={() => handleNavigate('/team')} style={styles.menuItem}>
              <Users size={20} color={COLORS.navy} />
              <Text style={styles.menuText}>Echipa mea</Text>
              {user?.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </Pressable>
          )}

          <View style={styles.separator} />

          <Pressable onPress={() => handleNavigate('/pricing')} style={styles.menuItem}>
            <CreditCard size={20} color={COLORS.navy} />
            <Text style={styles.menuText}>Planul meu</Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable onPress={handleLogout} style={styles.menuItem}>
            <LogOut size={20} color="#DC2626" />
            <Text style={[styles.menuText, { color: '#DC2626' }]}>Deconectare</Text>
          </Pressable>
        </View>

        {/* Delete Account */}
        <Pressable onPress={handleDeleteAccount} style={styles.deleteButton}>
          <Trash2 size={16} color="#DC2626" />
          <Text style={styles.deleteButtonText}>Șterge contul</Text>
        </Pressable>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Meetings.ro v{require('../../package.json').version}</Text>
          <Text style={styles.footerText}>Enterprise Platform</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: COLORS.ivory,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FAF8F3',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
    paddingTop: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: COLORS.navy,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220,38,38,0.15)',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  adminBadge: {
    marginLeft: 'auto',
    backgroundColor: '#DC262618',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
});
