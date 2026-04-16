import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Crown, Zap, Building2, ArrowLeft } from 'lucide-react-native';
import { COLORS } from '../src/constants/theme';
import { PRICING_PLANS, API_BASE_URL } from '../src/constants/config';
import { useAuth } from '../src/context/AuthContext';
import { PricingTier } from '../src/types';
import { authenticatedFetch } from '../src/utils/authenticatedFetch';

export default function PricingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updatePlan } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const tierIcons: Record<string, any> = {
    FREE: Zap,
    PRO: Crown,
    ENTERPRISE: Building2,
  };

  const tierColors: Record<string, string> = {
    FREE: '#6B7280',
    PRO: COLORS.gold,
    ENTERPRISE: COLORS.navy,
  };

  const handleSelectPlan = async (tier: PricingTier) => {
    // Free plan — just update locally
    if (tier === 'FREE') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updatePlan(tier);
      router.replace('/');
      return;
    }

    // Paid plans — open Stripe Checkout
    setLoadingTier(tier);
    try {
      const planKey = tier === 'PRO' ? 'pro' : 'enterprise';
      const res = await authenticatedFetch(`${API_BASE_URL}/api/payments/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planKey,
          interval: billingCycle === 'yearly' ? 'yearly' : 'monthly',
          user_email: user?.email || '',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Eroare server' }));
        throw new Error(err.detail || 'Eroare la crearea sesiunii de plată');
      }

      const { url } = await res.json();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Linking.openURL(url);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Eroare', error.message || 'Nu s-a putut deschide pagina de plată');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <View className="flex-1 bg-ivory" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="flex-row items-center px-4 h-14">
        <Pressable
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-navy/10"
        >
          <ArrowLeft size={24} stroke={COLORS.navy} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-8">
        <Text className="text-navy text-3xl font-heading text-center mb-2">
          Alege planul tău
        </Text>
        <Text className="text-gray-500 font-body text-base text-center mb-6">
          Începe gratuit, upgrade oricând
        </Text>

        {/* Billing Toggle */}
        <View className="flex-row bg-white rounded-xl p-1 mb-6 self-center">
          <Pressable
            onPress={() => setBillingCycle('monthly')}
            className={`px-5 py-2.5 rounded-lg ${billingCycle === 'monthly' ? 'bg-navy' : ''}`}
          >
            <Text className={`font-body text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>
              Lunar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBillingCycle('yearly')}
            className={`px-5 py-2.5 rounded-lg flex-row items-center gap-1 ${billingCycle === 'yearly' ? 'bg-navy' : ''}`}
          >
            <Text className={`font-body text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-gray-500'}`}>
              Anual
            </Text>
            {billingCycle !== 'yearly' && (
              <View className="bg-green-100 rounded px-1.5 py-0.5">
                <Text className="text-green-700 font-body text-xs font-medium">-20%</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Plans */}
        <View className="gap-4">
          {PRICING_PLANS.map((plan) => {
            const Icon = tierIcons[plan.tier];
            const isCurrentPlan = user?.plan === plan.tier;
            const isHighlighted = 'highlight' in plan && plan.highlight;
            const price = billingCycle === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12);

            return (
              <View
                key={plan.tier}
                className={`rounded-2xl p-5 ${
                  isHighlighted
                    ? 'bg-navy'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {/* Badge */}
                {isHighlighted && (
                  <View className="bg-gold/20 self-start rounded-full px-3 py-1 mb-3">
                    <Text className="text-gold font-body text-xs font-medium">Recomandat</Text>
                  </View>
                )}

                {/* Plan Header */}
                <View className="flex-row items-center gap-3 mb-3">
                  <View
                    className="w-10 h-10 rounded-lg items-center justify-center"
                    style={{ backgroundColor: isHighlighted ? 'rgba(255,255,255,0.15)' : `${tierColors[plan.tier]}15` }}
                  >
                    <Icon size={20} color={isHighlighted ? 'white' : tierColors[plan.tier]} />
                  </View>
                  <View>
                    <Text className={`font-heading text-lg ${isHighlighted ? 'text-white' : 'text-navy'}`}>
                      {plan.name}
                    </Text>
                  </View>
                </View>

                {/* Price */}
                <View className="flex-row items-baseline mb-4">
                  <Text className={`font-heading text-4xl ${isHighlighted ? 'text-white' : 'text-navy'}`}>
                    {price === 0 ? 'Gratis' : `€${price}`}
                  </Text>
                  {price > 0 && (
                    <Text className={`font-body text-sm ml-1 ${isHighlighted ? 'text-white/60' : 'text-gray-400'}`}>
                      / lună
                    </Text>
                  )}
                </View>

                {/* Features */}
                <View className="gap-2.5 mb-5">
                  {plan.features.map((feature, i) => (
                    <View key={i} className="flex-row items-start gap-2.5">
                      <View
                        className="w-5 h-5 rounded-full items-center justify-center mt-0.5"
                        style={{ backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : '#E5F3E8' }}
                      >
                        <Check size={12} color={isHighlighted ? 'white' : '#22C55E'} />
                      </View>
                      <Text className={`font-body text-sm flex-1 ${isHighlighted ? 'text-white/90' : 'text-gray-600'}`}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* CTA */}
                <Pressable
                  onPress={() => {
                    if (isCurrentPlan && plan.tier === 'FREE') {
                      router.replace('/');
                    } else if (!isCurrentPlan) {
                      handleSelectPlan(plan.tier as PricingTier);
                    }
                  }}
                  disabled={isCurrentPlan && plan.tier !== 'FREE' || loadingTier === plan.tier}
                  className={`h-12 rounded-xl items-center justify-center flex-row gap-2 ${
                    isCurrentPlan && plan.tier !== 'FREE'
                      ? 'bg-gray-200'
                      : isHighlighted
                      ? 'bg-white'
                      : 'bg-navy'
                  }`}
                >
                  {loadingTier === plan.tier ? (
                    <ActivityIndicator size="small" color={isHighlighted ? COLORS.navy : 'white'} />
                  ) : (
                    <Text
                      className={`font-heading text-sm ${
                        isCurrentPlan && plan.tier !== 'FREE'
                          ? 'text-gray-400'
                          : isHighlighted
                          ? 'text-navy'
                          : 'text-white'
                      }`}
                    >
                      {isCurrentPlan
                        ? plan.tier === 'FREE' ? 'Mergi la Home' : 'Plan activ'
                        : price === 0 ? 'Începe gratuit' : 'Alege planul'}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <Text className="text-gray-400 font-body text-xs text-center mt-6">
          Poți schimba sau anula planul oricând.{'\n'}Fără angajament pe termen lung.
        </Text>
      </ScrollView>
    </View>
  );
}
