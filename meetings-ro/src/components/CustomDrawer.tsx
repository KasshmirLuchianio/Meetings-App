import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Home, FolderOpen, Calendar, Settings, X } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

export default function CustomDrawer(props: any) {
  const router = useRouter();

  const handleNavigate = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
    props.navigation.closeDrawer();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    props.navigation.closeDrawer();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meetings.ro</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <X size={24} color={COLORS.navy} />
        </Pressable>
      </View>

      {/* Menu Items */}
      <DrawerContentScrollView {...props} style={styles.scrollView}>
        <Pressable
          onPress={() => handleNavigate('/')}
          style={styles.menuItem}
        >
          <Home size={20} color={COLORS.navy} />
          <Text style={styles.menuText}>Acasă</Text>
        </Pressable>

        <Pressable
          onPress={() => handleNavigate('/browse')}
          style={styles.menuItem}
        >
          <FolderOpen size={20} color={COLORS.navy} />
          <Text style={styles.menuText}>Întâlniri</Text>
        </Pressable>

        <Pressable
          onPress={() => handleNavigate('/calendar')}
          style={styles.menuItem}
        >
          <Calendar size={20} color={COLORS.navy} />
          <Text style={styles.menuText}>Calendar</Text>
        </Pressable>

        <View style={styles.separator} />

        <Pressable
          onPress={() => handleNavigate('/onboarding')}
          style={styles.menuItem}
        >
          <Settings size={20} color={COLORS.navy} />
          <Text style={styles.menuText}>Setări → Workspace</Text>
        </Pressable>
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
        <Text style={styles.footerText}>Expo SDK 54</Text>
      </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.navy,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    marginVertical: 12,
    marginHorizontal: 16,
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
});
