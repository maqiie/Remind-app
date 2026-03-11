// App.jsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import Toast from 'react-native-toast-message';

import AppNavigator from './src/navigation';
import useAuthStore from './src/store/authStore';

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const setLoading = useAuthStore((s) => s.setLoading);

  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    // Safety timeout — force past loader after 3s if initialize hangs
    const timeout = setTimeout(() => {
      console.warn('Auth init timed out');
      setLoading(false);
    }, 3000);

    initialize().finally(() => clearTimeout(timeout));

    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  // Don't render ANYTHING until fonts are loaded
  // This prevents the 'serifBold of undefined' crash
  if (!fontsLoaded) {
    return (
      <View style={s.splash}>
        <View style={s.logoOuter}>
          <View style={s.logoInner} />
          <View style={s.logoDot} />
        </View>
        <Text style={s.wordmark}>remind</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
      <Toast
        config={{
          success: ({ text1, text2 }) => (
            <View style={s.toastSuccess}>
              <Text style={s.toastTitle}>{text1}</Text>
              {text2 ? <Text style={s.toastBody}>{text2}</Text> : null}
            </View>
          ),
          error: ({ text1, text2 }) => (
            <View style={s.toastError}>
              <Text style={s.toastTitle}>{text1}</Text>
              {text2 ? <Text style={s.toastBody}>{text2}</Text> : null}
            </View>
          ),
        }}
      />
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#F7F6F2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: '#6B9E78',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#6B9E78',
    opacity: 0.5,
  },
  logoDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B9E78',
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#1C1C1E',
  },
  toastSuccess: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#6B9E78',
    elevation: 4,
  },
  toastError: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#D94F4F',
    elevation: 4,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  toastBody: {
    fontSize: 13,
    color: '#6E6E73',
    marginTop: 2,
  },
});