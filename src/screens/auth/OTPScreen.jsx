// src/screens/auth/OTPScreen.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';

import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import { colors, typography, fonts, spacing, radius, shadows } from '../../theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

// ── Single OTP digit cell ─────────────────────────────────────────────────────
const OtpCell = ({ value, focused, hasError }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.08 : 1,
        useNativeDriver: false,
        speed: 50,
        bounciness: 8,
      }),
      Animated.timing(borderColorAnim, {
        toValue: focused ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasError ? colors.error : value ? colors.textPrimary : colors.border,
      colors.primary,
    ],
  });

  const bgColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      hasError ? colors.errorLight : value ? colors.bgCard : colors.bgInput,
      colors.bgCard,
    ],
  });

  return (
    <Animated.View
      style={[
        styles.otpCell,
        {
          borderColor,
          backgroundColor: bgColor,
          transform: [{ scale: scaleAnim }],
        },
        focused && shadows.sm,
      ]}
    >
      <Text style={[styles.otpDigit, !value && styles.otpPlaceholder, hasError && styles.otpDigitError]}>
        {value || (focused ? '' : '·')}
      </Text>
    </Animated.View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function OTPScreen({ navigation }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hasError, setHasError] = useState(false);

  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);
  const cancelOtp = useAuthStore((s) => s.cancelOtp);
  const otpEmail = useAuthStore((s) => s.otpEmail);

  const inputRefs = useRef(Array(OTP_LENGTH).fill(null).map(() => React.createRef()));
  const hiddenInputRef = useRef(null);
  const timerRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      slideAnim.setValue(28);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 520, delay: 80, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 520, delay: 80, useNativeDriver: false }),
      ]).start();
      // Auto-focus
      setTimeout(() => hiddenInputRef.current?.focus(), 400);
    }, [])
  );

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: false }),
    ]).start();
  };

  const handleOtpChange = (text) => {
    // Strip non-digits and limit to OTP_LENGTH
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    const newOtp = Array(OTP_LENGTH).fill('');
    digits.forEach((d, i) => { newOtp[i] = d; });
    setOtp(newOtp);
    setHasError(false);
    setFocusedIndex(Math.min(digits.length, OTP_LENGTH - 1));

    // Auto-submit when complete
    if (digits.length === OTP_LENGTH) {
      handleVerify(digits.join(''));
    }
  };

  const handleVerify = async (code) => {
    const otpCode = code ?? otp.join('');
    if (otpCode.length < OTP_LENGTH) return;
    setLoading(true);
    setHasError(false);
    try {
      await verifyOtp({ email: otpEmail, otp: otpCode });
      // Navigation handled by navigator reacting to isAuthenticated
    } catch (err) {
      setHasError(true);
      shake();
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Invalid or expired code';
      Toast.show({ type: 'error', text1: 'Verification failed', text2: msg });
      // Clear inputs
      setOtp(Array(OTP_LENGTH).fill(''));
      setFocusedIndex(0);
      hiddenInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendOtp();
      setCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      setFocusedIndex(0);
      setHasError(false);
      hiddenInputRef.current?.focus();
      Toast.show({ type: 'success', text1: 'Code sent!', text2: `Check ${otpEmail}` });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to resend', text2: 'Please try again shortly.' });
    } finally {
      setResending(false);
    }
  };

  const filledCount = otp.filter(Boolean).length;
  const progressWidth = (filledCount / OTP_LENGTH) * 100;

  // Mask email for display
  const maskedEmail = otpEmail
    ? otpEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c)
    : '';

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
            <TouchableOpacity
              onPress={() => { cancelOtp(); navigation.goBack(); }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>

          {/* Header */}
          <Animated.View style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="mail-unread-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.stepLabel}>Verification</Text>
            <Text style={styles.heading}>Check your{'\n'}inbox</Text>
            <Text style={styles.subheading}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.emailHighlight}>{maskedEmail}</Text>
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, shadows.md, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Hidden full-width input captures keyboard */}
            <TextInput
              ref={hiddenInputRef}
              style={styles.hiddenInput}
              value={otp.join('')}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus={false}
            />

            {/* OTP Cells */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => hiddenInputRef.current?.focus()}
            >
              <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
                {otp.map((digit, i) => (
                  <OtpCell
                    key={i}
                    value={digit}
                    focused={focusedIndex === i}
                    hasError={hasError}
                  />
                ))}
              </Animated.View>
            </TouchableOpacity>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBar, { width: `${progressWidth}%` }]} />
            </View>

            {hasError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                <Text style={styles.errorText}>Incorrect code. Please try again.</Text>
              </View>
            )}

            <Button
              title="Verify Code"
              onPress={() => handleVerify()}
              loading={loading}
              disabled={filledCount < OTP_LENGTH}
              size="lg"
              style={styles.verifyBtn}
            />

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive it? </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={cooldown > 0 || resending}
              >
                {cooldown > 0 ? (
                  <Text style={styles.resendCooldown}>
                    Resend in {cooldown}s
                  </Text>
                ) : (
                  <Text style={[styles.resendLink, resending && { opacity: 0.5 }]}>
                    {resending ? 'Sending...' : 'Resend code'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Expiry note */}
          <Animated.View style={[styles.note, { opacity: fadeAnim }]}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.noteText}>Code expires in 10 minutes</Text>
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
  emailHighlight: {
    fontFamily: fonts.sansMedium,
    color: colors.textPrimary,
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Hidden input
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  // OTP cells
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  otpCell: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  otpPlaceholder: {
    color: colors.border,
    fontSize: 18,
  },
  otpDigitError: {
    color: colors.error,
  },

  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: colors.bgInput,
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },

  verifyBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resendLink: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: fonts.sansMedium,
  },
  resendCooldown: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: fonts.sansMedium,
  },

  // Note
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  noteText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});