// src/screens/auth/LoginScreen.jsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';

import useAuthStore from '../../store/authStore';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, typography, fonts, spacing, radius, shadows } from '../../theme';

// ── Logo Mark ─────────────────────────────────────────────────────────────────
const LogoMark = () => (
  <View style={styles.logoMark}>
    <View style={styles.logoOuter}>
      <View style={styles.logoInner} />
      <View style={styles.logoDot} />
    </View>
  </View>
);

// ── Login Screen ──────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const requestLogin = useAuthStore((s) => s.requestLogin);
  const passwordRef = useRef(null);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

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

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Minimum 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
  if (!validate()) return;
  setLoading(true);
  try {
    await requestLogin({ email: email.trim().toLowerCase(), password });
    navigation.navigate('OTP'); // ← add it here, inside the try block
  } catch (err) {
    const msg = err?.response?.data?.errors?.join(', ') || 'Invalid email or password';
    Toast.show({ type: 'error', text1: 'Login failed', text2: msg });
  } finally {
    setLoading(false);
  }
};

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
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LogoMark />
            <Text style={styles.wordmark}>remind</Text>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
            </View>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, shadows.md, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to your account</Text>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
                placeholder="you@example.com"
                keyboardType="email-address"
                leftIcon="mail-outline"
                error={errors.email}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />

              <Input
                inputRef={passwordRef}
                label="Password"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                placeholder="••••••••"
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={errors.password}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotRow}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={styles.submitBtn}
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Create one</Text>
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
    paddingTop: spacing.xxxl + spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },

  // Logo
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoMark: {
    marginBottom: spacing.sm,
  },
  logoOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    opacity: 0.5,
  },
  logoDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  wordmark: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  dividerRow: {
    marginTop: spacing.md,
    width: 32,
    alignItems: 'center',
  },
  divider: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
    opacity: 0.5,
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontFamily: fonts.serif,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  subheading: {
    ...typography.subheading,
    marginBottom: spacing.xl,
    fontSize: 14,
  },

  // Form
  form: {
    marginBottom: spacing.sm,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  forgotText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: fonts.sansMedium,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontSize: 14,
  },
});