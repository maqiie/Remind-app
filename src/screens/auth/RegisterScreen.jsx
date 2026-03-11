// src/screens/auth/RegisterScreen.jsx
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
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';

import useAuthStore from '../../store/authStore';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, typography, fonts, spacing, radius, shadows } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [birthday, setBirthday] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const register = useAuthStore((s) => s.register);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

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
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Minimum 6 characters';
    if (!passwordConfirmation) e.passwordConfirmation = 'Please confirm your password';
    else if (password !== passwordConfirmation) e.passwordConfirmation = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        passwordConfirmation,
        birthday: birthday ? format(birthday, 'yyyy-MM-dd') : null,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.full_messages?.join(', ') ||
        err?.response?.data?.errors?.join(', ') ||
        'Registration failed. Please try again.';
      Toast.show({ type: 'error', text1: 'Registration failed', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => setErrors((e) => ({ ...e, [field]: '' }));

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
          {/* Back button */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </Animated.View>

          {/* Heading */}
          <Animated.View style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.stepLabel}>Create account</Text>
            <Text style={styles.heading}>Let's get{'\n'}you started</Text>
            <Text style={styles.subheading}>Fill in your details below</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[styles.card, shadows.md, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Input
              label="Full Name"
              value={name}
              onChangeText={(t) => { setName(t); clearError('name'); }}
              placeholder="Mark Paul"
              autoCapitalize="words"
              leftIcon="person-outline"
              error={errors.name}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <Input
              inputRef={emailRef}
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); clearError('email'); }}
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
              onChangeText={(t) => { setPassword(t); clearError('password'); }}
              placeholder="••••••••"
              secureTextEntry
              leftIcon="lock-closed-outline"
              error={errors.password}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />

            <Input
              inputRef={confirmRef}
              label="Confirm Password"
              value={passwordConfirmation}
              onChangeText={(t) => { setPasswordConfirmation(t); clearError('passwordConfirmation'); }}
              placeholder="••••••••"
              secureTextEntry
              leftIcon="shield-checkmark-outline"
              error={errors.passwordConfirmation}
              returnKeyType="done"
            />

            {/* Birthday picker */}
            <View style={styles.birthdayWrapper}>
              <Text style={styles.birthdayLabel}>Birthday <Text style={styles.optional}>(optional)</Text></Text>
              <TouchableOpacity
                style={styles.birthdayTrigger}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="calendar-outline" size={18} color={birthday ? colors.primary : colors.textMuted} style={{ marginRight: spacing.sm }} />
                <Text style={[styles.birthdayText, birthday && styles.birthdayTextSet]}>
                  {birthday ? format(birthday, 'MMMM d, yyyy') : 'Select your birthday'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={birthday || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setBirthday(date);
                }}
              />
            )}

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              size="lg"
              style={styles.submitBtn}
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign in</Text>
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
    marginBottom: spacing.xs,
  },
  subheading: {
    ...typography.subheading,
    fontSize: 14,
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

  // Birthday
  birthdayWrapper: {
    marginBottom: spacing.md,
  },
  birthdayLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  optional: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'none',
    letterSpacing: 0,
    fontFamily: fonts.sans,
  },
  birthdayTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    minHeight: 52,
  },
  birthdayText: {
    flex: 1,
    ...typography.body,
    color: colors.textMuted,
  },
  birthdayTextSet: {
    color: colors.textPrimary,
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