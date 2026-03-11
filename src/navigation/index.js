// src/navigation/index.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View, ActivityIndicator, Text, Animated,
  StyleSheet, Platform,
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { colors, fonts } from '../theme';
import client from '../api/client';

// ─── AUTH SCREENS ────────────────────────────────────────────────────────────
import LoginScreen           from '../screens/auth/LoginScreen';
import RegisterScreen        from '../screens/auth/RegisterScreen';
import OTPScreen             from '../screens/auth/OTPScreen';
import ForgotPasswordScreen  from '../screens/auth/ForgotPasswordScreen';

// ─── MAIN SCREENS ────────────────────────────────────────────────────────────
import HomeScreen               from '../screens/home/HomeScreen';
import RemindersScreen          from '../screens/reminders/RemindersScreen';
import CreateReminderScreen     from '../screens/reminders/CreateReminderScreen';
import ReminderDetailScreen     from '../screens/reminders/ReminderDetailScreen';
import InvitationsScreen        from '../screens/reminders/InvitationsScreen';
import CompletedTasksScreen     from '../screens/tasks/CompletedTasksScreen';
import NotesScreen              from '../screens/reminders/NotesScreen';
import FriendsScreen            from '../screens/social/FriendsScreen';
import ChatListScreen           from '../screens/social/ChatListScreen';
import ChatScreen               from '../screens/social/ChatScreen';
import OrganizationsScreen      from '../screens/organizations/OrganizationsScreen';
import OrganizationDetailScreen from '../screens/organizations/OrganizationDetailScreen';
import CreateOrganizationScreen from '../screens/organizations/CreateOrganizationScreen';
import NotificationsScreen      from '../screens/notifications/NotificationsScreen';
import ProfileScreen            from '../screens/profile/ProfileScreen';

// ─── Design tokens (mirrors HomeScreen) ─────────────────────────────────────
const T = {
  cream:       '#FAF8F5',
  creamDeep:   '#F2EEE8',
  creamBorder: 'rgba(0,0,0,0.07)',
  ink:         '#1C1917',
  inkMid:      '#57534E',
  inkLight:    '#A8A29E',
  inkGhost:    '#D6D3D1',
  sage:        '#4A7C59',
  sageMid:     '#6B9E78',
  sageLight:   '#EAF2EC',
  ember:       '#C2500A',
  emberLight:  '#FEF3EC',
  white:       '#FFFFFF',
  shadowColor: '#1C1917',
};

// ─── Stacks ──────────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const STACK_OPTS = { headerShown: false };

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="OTP"            component={OTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

function RemindersStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="RemindersList"  component={RemindersScreen} />
      <Stack.Screen name="CreateReminder" component={CreateReminderScreen} />
      <Stack.Screen name="ReminderDetail" component={ReminderDetailScreen} />
      <Stack.Screen name="Invitations"    component={InvitationsScreen} />
      <Stack.Screen name="Notes"          component={NotesScreen} />
      <Stack.Screen name="CompletedTasks" component={CompletedTasksScreen} />
    </Stack.Navigator>
  );
}

function SocialStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="Friends"  component={FriendsScreen} />
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Chat"     component={ChatScreen} />
    </Stack.Navigator>
  );
}

function OrgsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_OPTS}>
      <Stack.Screen name="OrgsList"  component={OrganizationsScreen} />
      <Stack.Screen name="OrgDetail" component={OrganizationDetailScreen} />
      <Stack.Screen name="CreateOrg" component={CreateOrganizationScreen} />
    </Stack.Navigator>
  );
}

// ─── Tab config ──────────────────────────────────────────────────────────────
const TAB_CONFIG = [
  { name: 'Home',          label: 'Home',    icon: 'home',          iconOff: 'home-outline' },
  { name: 'RemindersTab',  label: 'Tasks',   icon: 'calendar',      iconOff: 'calendar-outline' },
  { name: 'SocialTab',     label: 'Social',  icon: 'people',        iconOff: 'people-outline' },
  { name: 'OrgsTab',       label: 'Orgs',    icon: 'business',      iconOff: 'business-outline' },
  { name: 'Notifications', label: 'Alerts',  icon: 'notifications', iconOff: 'notifications-outline' },
  { name: 'Profile',       label: 'Profile', icon: 'person',        iconOff: 'person-outline' },
];

// ─── Animated Tab Button ─────────────────────────────────────────────────────
function TabButton({ children, onPress, accessibilityState }) {
  const focused = accessibilityState?.selected;
  const scale   = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start();
    onPress?.();
  };

  return (
    <Animated.View style={[nav.tabBtn, { transform: [{ scale }] }]}>
      <TouchableTabArea onPress={handlePress}>
        {children}
      </TouchableTabArea>
    </Animated.View>
  );
}

// Thin wrapper so we can still call onPress without importing TouchableOpacity at top
import { TouchableOpacity } from 'react-native';
const TouchableTabArea = ({ children, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={1} style={nav.tabTouch}>
    {children}
  </TouchableOpacity>
);

// ─── Tab Icon ─────────────────────────────────────────────────────────────────
function TabIcon({ routeName, focused, badgeCount = 0 }) {
  const cfg   = TAB_CONFIG.find((t) => t.name === routeName);
  const icon  = focused ? cfg?.icon : cfg?.iconOff;
  const color = focused ? T.sage : T.inkLight;

  // Animated dot indicator
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(dotScale, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [focused]);

  return (
    <View style={nav.iconWrap}>
      {/* Active pill background */}
      {focused && (
        <Animated.View
          style={[nav.activePill, { transform: [{ scale: dotScale }] }]}
        />
      )}
      <View style={nav.iconInner}>
        <Ionicons name={icon || 'apps-outline'} size={20} color={color} />
        {/* Badge */}
        {badgeCount > 0 && (
          <View style={nav.badge}>
            <Text style={nav.badgeTxt}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Tabs ───────────────────────────────────────────────────────────────
function MainTabs() {
  const [inviteCount, setInviteCount] = useState(0);
  const [notifCount,  setNotifCount]  = useState(0);

  // Poll invitations + unread notifications every 30s
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [invRes, notifRes] = await Promise.allSettled([
          client.get('/invitations'),
          client.get('/notifications'),
        ]);

        if (invRes.status === 'fulfilled') {
          const data = invRes.value.data;
          const list = Array.isArray(data) ? data : (data?.invitations || []);
          setInviteCount(list.filter((i) => i.status === 'pending').length);
        }

        if (notifRes.status === 'fulfilled') {
          const data = notifRes.value.data;
          const list = Array.isArray(data) ? data : (data?.notifications || []);
          setNotifCount(list.filter((n) => !n.read).length);
        }
      } catch {
        // silent — badges just won't update
      }
    };

    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor:   T.sage,
        tabBarInactiveTintColor: T.inkLight,

        // ── Tab bar container ──────────────────────────────────────────
        tabBarStyle: nav.bar,

        // ── Label ──────────────────────────────────────────────────────
        tabBarLabelStyle: nav.label,

        // ── Icon renderer ──────────────────────────────────────────────
        tabBarIcon: ({ focused }) => {
          const badge =
            route.name === 'RemindersTab'  ? inviteCount :
            route.name === 'Notifications' ? notifCount  : 0;
          return <TabIcon routeName={route.name} focused={focused} badgeCount={badge} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="RemindersTab"
        component={RemindersStack}
        options={{ tabBarLabel: 'Tasks' }}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialStack}
        options={{ tabBarLabel: 'Social' }}
      />
      <Tab.Screen
        name="OrgsTab"
        component={OrgsStack}
        options={{ tabBarLabel: 'Orgs' }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'Alerts' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  const pulse = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={load.screen}>
      {/* Decorative ring */}
      <View style={load.ringOuter}>
        <View style={load.ringInner}>
          <Animated.View style={[load.logoDot, { opacity: pulse }]} />
        </View>
      </View>
      <Animated.Text style={[load.wordmark, { opacity: pulse }]}>remind</Animated.Text>
      <ActivityIndicator
        size="small"
        color={T.sage}
        style={{ marginTop: 32 }}
      />
    </View>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary:      T.sage,
          background:   T.cream,
          card:         T.white,
          text:         T.ink,
          border:       T.creamBorder,
          notification: T.ember,
        },
      }}
    >
      {!isAuthenticated ? <AuthStack /> : <MainTabs />}
    </NavigationContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const nav = StyleSheet.create({
  // Bar container — floats above the screen floor
  bar: {
    position: 'absolute',
    backgroundColor: T.white,
    borderTopWidth: 0,
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'ios' ? 24 : 14,
    borderRadius: 26,
    height: 66,
    paddingBottom: 0,
    paddingTop: 0,
    // Crisp shadow
    shadowColor: T.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 14,
    // Subtle cream border
    borderWidth: 1,
    borderColor: T.creamBorder,
  },

  // Label
  label: {
    fontSize: 10,
    fontFamily: fonts.sansMedium,
    marginTop: 2,
    letterSpacing: 0.1,
  },

  // Per-tab button
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    width: '100%',
  },

  // Icon wrapper
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    position: 'relative',
  },

  // Active state pill behind the icon
  activePill: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.sageLight,
  },

  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Notification badge
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: T.ember,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: T.white,
  },
  badgeTxt: {
    color: '#FFF',
    fontSize: 8,
    fontFamily: fonts.sansMedium,
    letterSpacing: 0.2,
  },
});

const load = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: T.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ringInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: T.sageMid,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.sage,
  },
  wordmark: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: T.ink,
    letterSpacing: -0.8,
  },
});