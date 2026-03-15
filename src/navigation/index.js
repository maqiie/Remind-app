// src/navigation/index.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Animated, StyleSheet,
  Platform, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { fonts } from '../theme';
import client from '../api/client';

// ─── AUTH SCREENS ─────────────────────────────────────────────────────────────
import LoginScreen           from '../screens/auth/LoginScreen';
import RegisterScreen        from '../screens/auth/RegisterScreen';
import OTPScreen             from '../screens/auth/OTPScreen';
import ForgotPasswordScreen  from '../screens/auth/ForgotPasswordScreen';

// ─── MAIN SCREENS ─────────────────────────────────────────────────────────────
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  cream:       '#FAF8F5',
  creamBorder: 'rgba(0,0,0,0.07)',
  ink:         '#1C1917',
  inkLight:    '#A8A29E',
  sage:        '#4A7C59',
  sageMid:     '#6B9E78',
  sageLight:   '#EAF2EC',
  ember:       '#C2500A',
  white:       '#FFFFFF',
  shadowColor: '#1C1917',
};

// ─── Navigators ───────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const STACK_OPTS = { headerShown: false };

// ─── Stacks ───────────────────────────────────────────────────────────────────
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
      <Stack.Screen name="HomeScreen" component={HomeScreen} />
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
      <Stack.Screen name="OrgsListScreen"  component={OrganizationsScreen} />
      <Stack.Screen name="OrgDetailScreen" component={OrganizationDetailScreen} />
      <Stack.Screen name="CreateOrgScreen" component={CreateOrganizationScreen} />
    </Stack.Navigator>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TAB_CONFIG = [
  { name: 'Home',          icon: 'home',          iconOff: 'home-outline' },
  { name: 'RemindersTab',  icon: 'calendar',      iconOff: 'calendar-outline' },
  { name: 'SocialTab',     icon: 'people',        iconOff: 'people-outline' },
  { name: 'OrgsTab',       icon: 'business',      iconOff: 'business-outline' },
  { name: 'Notifications', icon: 'notifications', iconOff: 'notifications-outline' },
  { name: 'Profile',       icon: 'person',        iconOff: 'person-outline' },
];

// ─── Tab Icon ─────────────────────────────────────────────────────────────────
function TabIcon({ routeName, focused, badgeCount, activeColor, inactiveColor, pillBg }) {
  const cfg   = TAB_CONFIG.find((t) => t.name === routeName);
  const icon  = focused ? cfg?.icon : cfg?.iconOff;
  const color = focused ? (activeColor || '#4ADE80') : (inactiveColor || '#5A5A6E');

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
      {focused && (
        <Animated.View style={[
          nav.activePill,
          { backgroundColor: pillBg || 'rgba(74,222,128,0.15)', transform: [{ scale: dotScale }] }
        ]} />
      )}
      <View style={nav.iconInner}>
        <Ionicons name={icon || 'apps-outline'} size={20} color={color} />
        {badgeCount > 0 && (
          <View style={nav.badge}>
            <Text style={nav.badgeTxt}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Floating tab bar style ────────────────────────────────────────────────────
// Exported so ChatScreen can restore it on unmount
export const FLOATING_TAB_STYLE = {
  position: 'absolute',
  backgroundColor: '#FFFFFF',
  borderTopWidth: 0,
  marginHorizontal: 14,
  marginBottom: Platform.OS === 'ios' ? 24 : 14,
  borderRadius: 26,
  height: 66,
  paddingBottom: 0,
  paddingTop: 0,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 20,
  elevation: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.07)',
};

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  const [inviteCount, setInviteCount] = useState(0);
  const [notifCount,  setNotifCount]  = useState(0);
  const isDark = useThemeStore(s => s.isDark);

  const tabStyle = {
    ...FLOATING_TAB_STYLE,
    backgroundColor: isDark ? '#13131A' : '#FFFFFF',
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
  };

  const activeColor   = isDark ? '#4ADE80' : '#16A34A';
  const inactiveColor = isDark ? '#5A5A6E' : '#A8A29E';
  const activePillBg  = isDark ? 'rgba(74,222,128,0.15)' : 'rgba(22,163,74,0.1)';

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
        // silent — badges just won't show
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
        tabBarActiveTintColor:   activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: tabStyle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fonts.sansMedium,
          marginTop: 2,
          letterSpacing: 0.1,
        },
        tabBarIcon: ({ focused }) => {
          const badge =
            route.name === 'RemindersTab'  ? inviteCount :
            route.name === 'Notifications' ? notifCount  : 0;
          return (
            <TabIcon
              routeName={route.name}
              focused={focused}
              badgeCount={badge}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              pillBg={activePillBg}
            />
          );
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
      <View style={load.ringOuter}>
        <View style={load.ringInner}>
          <Animated.View style={[load.logoDot, { opacity: pulse }]} />
        </View>
      </View>
      <Animated.Text style={[load.wordmark, { opacity: pulse }]}>
        remind
      </Animated.Text>
      <ActivityIndicator size="small" color={'#4ADE80'} style={{ marginTop: 32 }} />
    </View>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const isDark   = useThemeStore(s => s.isDark);
  const hydrate  = useThemeStore(s => s.hydrate);

  // Load persisted theme preference once on boot
  useEffect(() => { hydrate(); }, []);

  const bgColor = isDark ? '#0A0A0F' : '#F7F6F2';
  const fgColor = isDark ? '#F4F4F6' : '#1C1917';

  if (isLoading) return <LoadingScreen />;

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary:      isDark ? '#4ADE80' : '#16A34A',
          background:   bgColor,
          card:         isDark ? '#13131A' : '#FFFFFF',
          text:         fgColor,
          border:       isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          notification: isDark ? '#F87171' : '#DC2626',
        },
      }}
    >
      {!isAuthenticated ? <AuthStack /> : <MainTabs />}
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const nav = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#F87171',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ringInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  wordmark: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: '#F4F4F6',
    letterSpacing: -0.8,
  },
});
// // src/navigation/index.js
// import React, { useEffect, useState, useRef } from 'react';
// import {
//   View, Text, Animated, StyleSheet,
//   Platform, ActivityIndicator,
// } from 'react-native';
// import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import { Ionicons } from '@expo/vector-icons';
// import useAuthStore from '../store/authStore';
// import { fonts } from '../theme';
// import client from '../api/client';

// // ─── AUTH SCREENS ─────────────────────────────────────────────────────────────
// import LoginScreen           from '../screens/auth/LoginScreen';
// import RegisterScreen        from '../screens/auth/RegisterScreen';
// import OTPScreen             from '../screens/auth/OTPScreen';
// import ForgotPasswordScreen  from '../screens/auth/ForgotPasswordScreen';

// // ─── MAIN SCREENS ─────────────────────────────────────────────────────────────
// import HomeScreen               from '../screens/home/HomeScreen';
// import RemindersScreen          from '../screens/reminders/RemindersScreen';
// import CreateReminderScreen     from '../screens/reminders/CreateReminderScreen';
// import ReminderDetailScreen     from '../screens/reminders/ReminderDetailScreen';
// import InvitationsScreen        from '../screens/reminders/InvitationsScreen';
// import CompletedTasksScreen     from '../screens/tasks/CompletedTasksScreen';
// import NotesScreen              from '../screens/reminders/NotesScreen';
// import FriendsScreen            from '../screens/social/FriendsScreen';
// import ChatListScreen           from '../screens/social/ChatListScreen';
// import ChatScreen               from '../screens/social/ChatScreen';
// import OrganizationsScreen      from '../screens/organizations/OrganizationsScreen';
// import OrganizationDetailScreen from '../screens/organizations/OrganizationDetailScreen';
// import CreateOrganizationScreen from '../screens/organizations/CreateOrganizationScreen';
// import NotificationsScreen      from '../screens/notifications/NotificationsScreen';
// import ProfileScreen            from '../screens/profile/ProfileScreen';

// // ─── Design tokens ────────────────────────────────────────────────────────────
// const T = {
//   cream:       '#FAF8F5',
//   creamBorder: 'rgba(0,0,0,0.07)',
//   ink:         '#1C1917',
//   inkLight:    '#A8A29E',
//   sage:        '#4A7C59',
//   sageMid:     '#6B9E78',
//   sageLight:   '#EAF2EC',
//   ember:       '#C2500A',
//   white:       '#FFFFFF',
//   shadowColor: '#1C1917',
// };

// // ─── Navigators ───────────────────────────────────────────────────────────────
// const Stack = createNativeStackNavigator();
// const Tab   = createBottomTabNavigator();
// const STACK_OPTS = { headerShown: false };

// // ─── Stacks ───────────────────────────────────────────────────────────────────
// function AuthStack() {
//   return (
//     <Stack.Navigator screenOptions={STACK_OPTS}>
//       <Stack.Screen name="Login"          component={LoginScreen} />
//       <Stack.Screen name="Register"       component={RegisterScreen} />
//       <Stack.Screen name="OTP"            component={OTPScreen} />
//       <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
//     </Stack.Navigator>
//   );
// }

// function HomeStack() {
//   return (
//     <Stack.Navigator screenOptions={STACK_OPTS}>
//       <Stack.Screen name="HomeScreen" component={HomeScreen} />
//     </Stack.Navigator>
//   );
// }

// function RemindersStack() {
//   return (
//     <Stack.Navigator screenOptions={STACK_OPTS}>
//       <Stack.Screen name="RemindersList"  component={RemindersScreen} />
//       <Stack.Screen name="CreateReminder" component={CreateReminderScreen} />
//       <Stack.Screen name="ReminderDetail" component={ReminderDetailScreen} />
//       <Stack.Screen name="Invitations"    component={InvitationsScreen} />
//       <Stack.Screen name="Notes"          component={NotesScreen} />
//       <Stack.Screen name="CompletedTasks" component={CompletedTasksScreen} />
//     </Stack.Navigator>
//   );
// }

// function SocialStack() {
//   return (
//     <Stack.Navigator screenOptions={STACK_OPTS}>
//       <Stack.Screen name="Friends"  component={FriendsScreen} />
//       <Stack.Screen name="ChatList" component={ChatListScreen} />
//       {/*
//         Chat is inside SocialStack. ChatScreen hides the tab bar via
//         navigation.getParent().setOptions({ tabBarStyle: { display:'none' } })
//         and restores FLOATING_TAB_STYLE on unmount — no input-covered-by-tabs bug.
//       */}
//       <Stack.Screen name="Chat"     component={ChatScreen} />
//     </Stack.Navigator>
//   );
// }

// function OrgsStack() {
//   return (
//     <Stack.Navigator screenOptions={STACK_OPTS}>
//       {/*
//         Screen name must match what OrganizationsScreen navigates to:
//           navigate('OrgDetail', ...)  and  navigate('CreateOrg')
//       */}
//       <Stack.Screen name="OrgsListScreen" component={OrganizationsScreen} />
//       <Stack.Screen name="OrgDetail"      component={OrganizationDetailScreen} />
//       <Stack.Screen name="CreateOrg"      component={CreateOrganizationScreen} />
//     </Stack.Navigator>
//   );
// }

// // ─── Tab config ───────────────────────────────────────────────────────────────
// const TAB_CONFIG = [
//   { name: 'Home',          icon: 'home',          iconOff: 'home-outline' },
//   { name: 'RemindersTab',  icon: 'calendar',      iconOff: 'calendar-outline' },
//   { name: 'SocialTab',     icon: 'people',        iconOff: 'people-outline' },
//   { name: 'OrgsTab',       icon: 'business',      iconOff: 'business-outline' },
//   { name: 'Notifications', icon: 'notifications', iconOff: 'notifications-outline' },
//   { name: 'Profile',       icon: 'person',        iconOff: 'person-outline' },
// ];

// // ─── Tab Icon ─────────────────────────────────────────────────────────────────
// function TabIcon({ routeName, focused, badgeCount }) {
//   const cfg      = TAB_CONFIG.find((t) => t.name === routeName);
//   const iconName = focused ? cfg?.icon : cfg?.iconOff;
//   const color    = focused ? T.sage : T.inkLight;

//   const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
//   useEffect(() => {
//     Animated.spring(dotScale, {
//       toValue:      focused ? 1 : 0,
//       useNativeDriver: true,
//       tension:      80,
//       friction:     8,
//     }).start();
//   }, [focused]);

//   return (
//     <View style={nav.iconWrap}>
//       {focused && (
//         <Animated.View style={[nav.activePill, { transform: [{ scale: dotScale }] }]} />
//       )}
//       <View style={nav.iconInner}>
//         <Ionicons name={iconName || 'apps-outline'} size={20} color={color} />
//         {badgeCount > 0 && (
//           <View style={nav.badge}>
//             <Text style={nav.badgeTxt}>{badgeCount > 99 ? '99+' : String(badgeCount)}</Text>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }

// // ─── Floating tab bar style ────────────────────────────────────────────────────
// // Exported so ChatScreen can restore it on unmount via:
// //   navigation.getParent().setOptions({ tabBarStyle: FLOATING_TAB_STYLE })
// export const FLOATING_TAB_STYLE = {
//   position:        'absolute',
//   backgroundColor: T.white,
//   borderTopWidth:  0,
//   marginHorizontal: 14,
//   marginBottom:    Platform.OS === 'ios' ? 24 : 14,
//   borderRadius:    26,
//   height:          66,
//   paddingBottom:   0,
//   paddingTop:      0,
//   shadowColor:     T.shadowColor,
//   shadowOffset:    { width: 0, height: 8 },
//   shadowOpacity:   0.1,
//   shadowRadius:    20,
//   elevation:       14,
//   borderWidth:     1,
//   borderColor:     T.creamBorder,
// };

// // ─── Main Tabs ────────────────────────────────────────────────────────────────
// function MainTabs() {
//   const [inviteCount, setInviteCount] = useState(0);
//   const [notifCount,  setNotifCount]  = useState(0);

//   useEffect(() => {
//     const fetchCounts = async () => {
//       try {
//         const [invRes, notifRes] = await Promise.allSettled([
//           client.get('/invitations'),
//           client.get('/notifications'),
//         ]);
//         if (invRes.status === 'fulfilled') {
//           const data = invRes.value.data;
//           const list = Array.isArray(data) ? data : (data?.invitations || []);
//           setInviteCount(list.filter((i) => i.status === 'pending').length);
//         }
//         if (notifRes.status === 'fulfilled') {
//           const data = notifRes.value.data;
//           const list = Array.isArray(data) ? data : (data?.notifications || []);
//           setNotifCount(list.filter((n) => !n.read).length);
//         }
//       } catch {
//         // silent — badges just won't show
//       }
//     };
//     fetchCounts();
//     const id = setInterval(fetchCounts, 30_000);
//     return () => clearInterval(id);
//   }, []);

//   return (
//     <Tab.Navigator
//       screenOptions={({ route }) => ({
//         headerShown:            false,
//         tabBarShowLabel:        true,
//         tabBarActiveTintColor:  T.sage,
//         tabBarInactiveTintColor:T.inkLight,
//         tabBarStyle:            FLOATING_TAB_STYLE,
//         tabBarLabelStyle: {
//           fontSize:     10,
//           fontFamily:   fonts.sansMedium,
//           marginTop:    2,
//           letterSpacing:0.1,
//         },
//         tabBarIcon: ({ focused }) => {
//           const badge =
//             route.name === 'RemindersTab'  ? inviteCount :
//             route.name === 'Notifications' ? notifCount  : 0;
//           return (
//             <TabIcon
//               routeName={route.name}
//               focused={focused}
//               badgeCount={badge}
//             />
//           );
//         },
//       })}
//     >
//       <Tab.Screen
//         name="Home"
//         component={HomeStack}
//         options={{ tabBarLabel: 'Home' }}
//       />
//       <Tab.Screen
//         name="RemindersTab"
//         component={RemindersStack}
//         options={{ tabBarLabel: 'Tasks' }}
//       />
//       <Tab.Screen
//         name="SocialTab"
//         component={SocialStack}
//         options={{ tabBarLabel: 'Social' }}
//       />
//       <Tab.Screen
//         name="OrgsTab"
//         component={OrgsStack}
//         options={{ tabBarLabel: 'Orgs' }}
//       />
//       <Tab.Screen
//         name="Notifications"
//         component={NotificationsScreen}
//         options={{ tabBarLabel: 'Alerts' }}
//       />
//       <Tab.Screen
//         name="Profile"
//         component={ProfileScreen}
//         options={{ tabBarLabel: 'Profile' }}
//       />
//     </Tab.Navigator>
//   );
// }

// // ─── Loading Screen ───────────────────────────────────────────────────────────
// function LoadingScreen() {
//   const pulse = useRef(new Animated.Value(0.7)).current;
//   useEffect(() => {
//     Animated.loop(
//       Animated.sequence([
//         Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
//         Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
//       ])
//     ).start();
//   }, []);
//   return (
//     <View style={load.screen}>
//       <View style={load.ringOuter}>
//         <View style={load.ringInner}>
//           <Animated.View style={[load.logoDot, { opacity: pulse }]} />
//         </View>
//       </View>
//       <Animated.Text style={[load.wordmark, { opacity: pulse }]}>
//         remind
//       </Animated.Text>
//       <ActivityIndicator size="small" color={T.sage} style={{ marginTop: 32 }} />
//     </View>
//   );
// }

// // ─── Root Navigator ───────────────────────────────────────────────────────────
// export default function AppNavigator() {
//   const { isAuthenticated, isLoading } = useAuthStore();
//   if (isLoading) return <LoadingScreen />;
//   return (
//     <NavigationContainer
//       theme={{
//         ...DefaultTheme,
//         colors: {
//           ...DefaultTheme.colors,
//           primary:      T.sage,
//           background:   T.cream,
//           card:         T.white,
//           text:         T.ink,
//           border:       T.creamBorder,
//           notification: T.ember,
//         },
//       }}
//     >
//       {isAuthenticated ? <MainTabs /> : <AuthStack />}
//     </NavigationContainer>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const nav = StyleSheet.create({
//   iconWrap: {
//     alignItems:      'center',
//     justifyContent:  'center',
//     width:           36,
//     height:          36,
//     position:        'relative',
//   },
//   activePill: {
//     position:        'absolute',
//     width:           36,
//     height:          36,
//     borderRadius:    18,
//     backgroundColor: T.sageLight,
//   },
//   iconInner: {
//     alignItems:     'center',
//     justifyContent: 'center',
//     position:       'relative',
//   },
//   badge: {
//     position:        'absolute',
//     top:             -5,
//     right:           -8,
//     backgroundColor: T.ember,
//     borderRadius:    8,
//     minWidth:        15,
//     height:          15,
//     alignItems:      'center',
//     justifyContent:  'center',
//     paddingHorizontal: 3,
//     borderWidth:     1.5,
//     borderColor:     T.white,
//   },
//   badgeTxt: {
//     color:       '#FFF',
//     fontSize:    8,
//     fontFamily:  fonts.sansMedium,
//     letterSpacing: 0.2,
//   },
// });

// const load = StyleSheet.create({
//   screen: {
//     flex:            1,
//     backgroundColor: T.cream,
//     alignItems:      'center',
//     justifyContent:  'center',
//   },
//   ringOuter: {
//     width:        72,
//     height:       72,
//     borderRadius: 36,
//     borderWidth:  2,
//     borderColor:  T.sage,
//     alignItems:   'center',
//     justifyContent: 'center',
//     marginBottom: 16,
//   },
//   ringInner: {
//     width:        44,
//     height:       44,
//     borderRadius: 22,
//     borderWidth:  1.5,
//     borderColor:  T.sageMid,
//     alignItems:   'center',
//     justifyContent: 'center',
//     opacity:      0.5,
//   },
//   logoDot: {
//     width:           10,
//     height:          10,
//     borderRadius:    5,
//     backgroundColor: T.sage,
//   },
//   wordmark: {
//     fontFamily:   fonts.serifBold,
//     fontSize:     28,
//     color:        T.ink,
//     letterSpacing:-0.8,
//   },
// });