// src/screens/auth/ForgotPasswordScreen.jsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';

import { requestPasswordReset } from '../../api/auth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, typography, fonts, spacing, radius, shadows } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(28);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 520, delay: 80, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 520, delay: 80, useNativeDriver: true }),
      ]).start();
    }, [])
  );

  const animateToSuccess = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(successAnim, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    if (!email.trim()) { setEmailError('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setSent(true);
      animateToSuccess();
    } catch (err) {
      const msg = err?.response?.data?.errors?.join(', ') || 'Could not send reset email. Try again.';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  // ── Success State ─────────────────────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <Animated.View style={[styles.successContainer, { opacity: successAnim }]}>
          {/* Animated checkmark */}
          <View style={styles.successIconOuter}>
            <View style={styles.successIconInner}>
              <Ionicons name="checkmark" size={36} color={colors.primary} />
            </View>
            {/* Decorative rings */}
            <View style={styles.ring1} />
            <View style={styles.ring2} />
          </View>

          <Text style={styles.successHeading}>Check your email</Text>
          <Text style={styles.successBody}>
            We've sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.successTips}>
            {[
              { icon: 'folder-outline', text: `Check your spam folder if you don't see it`},
              { icon: 'time-outline', text: 'Link expires in 24 hours' },
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <Ionicons name={tip.icon} size={15} color={colors.primary} />
                </View>
                <Text style={styles.tipText}>{tip.text}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Back to Sign In"
            onPress={() => navigation.navigate('Login')}
            size="lg"
            style={styles.backToLoginBtn}
          />

          <TouchableOpacity
            onPress={() => { setSent(false); successAnim.setValue(0); fadeAnim.setValue(1); }}
            style={styles.tryAgainBtn}
          >
            <Text style={styles.tryAgainText}>Try a different email</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ── Input State ───────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>

          {/* Header */}
          <Animated.View style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.stepLabel}>Password reset</Text>
            <Text style={styles.heading}>Forgot your{'\n'}password?</Text>
            <Text style={styles.subheading}>
              No worries — enter your email and we'll send you a reset link.
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, shadows.md, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Input
              label="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(''); }}
              placeholder="you@example.com"
              keyboardType="email-address"
              leftIcon="mail-outline"
              error={emailError}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Button
              title="Send Reset Link"
              onPress={handleSubmit}
              loading={loading}
              size="lg"
              style={styles.submitBtn}
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.footerRow}
            >
              <Ionicons name="arrow-back-outline" size={14} color={colors.primary} />
              <Text style={styles.footerLink}>  Back to Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  // Back
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },

  // Header
  headerSection: {
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  heading: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subheading: {
    ...typography.subheading,
    fontSize: 14,
    lineHeight: 22,
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },

  // Footer
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontSize: 14,
  },

  // ── Success ──────────────────────────────────────────────
  successContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  successIconOuter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  successIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  ring1: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.primary,
    opacity: 0.25,
  },
  ring2: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: colors.primary,
    opacity: 0.12,
  },
  successHeading: {
    fontFamily: fonts.serif,
    fontSize: 28,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successBody: {
    ...typography.subheading,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emailHighlight: {
    fontFamily: fonts.sansMedium,
    color: colors.textPrimary,
  },
  successTips: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  backToLoginBtn: {
    marginBottom: spacing.md,
  },
  tryAgainBtn: {
    paddingVertical: spacing.sm,
  },
  tryAgainText: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});