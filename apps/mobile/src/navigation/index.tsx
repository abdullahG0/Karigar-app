import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme';

// Auth
import LoginScreen              from '../screens/shared/LoginScreen';
import RegisterScreen           from '../screens/shared/RegisterScreen';

// Resident
import HomeScreen               from '../screens/resident/HomeScreen';
import MyBookingsScreen         from '../screens/resident/MyBookingsScreen';
import ProfessionalListScreen   from '../screens/resident/ProfessionalListScreen';
import ProfessionalDetailScreen from '../screens/resident/ProfessionalDetailScreen';
import CreateBookingScreen      from '../screens/resident/CreateBookingScreen';
import BookingDetailScreen      from '../screens/resident/BookingDetailScreen';
import QuotesListScreen         from '../screens/resident/QuotesListScreen';
import ReviewScreen             from '../screens/resident/ReviewScreen';

// Professional
import DashboardScreen          from '../screens/professional/DashboardScreen';
import JobsScreen               from '../screens/professional/JobsScreen';
import JobDetailScreen          from '../screens/professional/JobDetailScreen';
import SendQuoteScreen          from '../screens/professional/SendQuoteScreen';
import ProfileScreen            from '../screens/professional/ProfileScreen';

// Shared
import ChatScreen               from '../screens/shared/ChatScreen';

import type {
  AuthStackParamList,
  ResidentStackParamList,
  ProfessionalStackParamList,
} from './types';

const AuthStack         = createNativeStackNavigator<AuthStackParamList>();
const ResidentStack     = createNativeStackNavigator<ResidentStackParamList>();
const ProfessionalStack = createNativeStackNavigator<ProfessionalStackParamList>();

const HEADER_OPTS = {
  headerStyle:         { backgroundColor: colors.card },
  headerTintColor:     colors.primary,
  headerTitleStyle:    { fontWeight: '700' as const, color: colors.text },
  headerShadowVisible: false,
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"    component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function ResidentNavigator() {
  return (
    <ResidentStack.Navigator screenOptions={HEADER_OPTS}>
      <ResidentStack.Screen name="Home"               component={HomeScreen}               options={{ headerShown: false }} />
      <ResidentStack.Screen name="MyBookings"         component={MyBookingsScreen}         options={{ headerShown: false }} />
      <ResidentStack.Screen name="ProfessionalList"   component={ProfessionalListScreen} />
      <ResidentStack.Screen name="ProfessionalDetail" component={ProfessionalDetailScreen} options={{ title: 'Professional Profile' }} />
      <ResidentStack.Screen name="CreateBooking"      component={CreateBookingScreen}      options={{ title: 'Request Service' }} />
      <ResidentStack.Screen name="BookingDetail"      component={BookingDetailScreen}      options={{ title: 'Booking Details' }} />
      <ResidentStack.Screen name="QuotesList"         component={QuotesListScreen}         options={{ title: 'Quotes Received' }} />
      <ResidentStack.Screen name="ReviewScreen"       component={ReviewScreen}             options={{ title: 'Leave a Review' }} />
      <ResidentStack.Screen name="ChatScreen"         component={ChatScreen}               options={{ title: '' }} />
    </ResidentStack.Navigator>
  );
}

function ProfessionalNavigator() {
  return (
    <ProfessionalStack.Navigator screenOptions={HEADER_OPTS}>
      <ProfessionalStack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <ProfessionalStack.Screen name="Jobs"      component={JobsScreen}      options={{ headerShown: false }} />
      <ProfessionalStack.Screen name="Profile"   component={ProfileScreen}   options={{ headerShown: false }} />
      <ProfessionalStack.Screen name="SendQuote" component={SendQuoteScreen} options={{ title: 'Send a Quote' }} />
      <ProfessionalStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Job Details' }} />
      <ProfessionalStack.Screen name="ChatScreen" component={ChatScreen}     options={{ title: '' }} />
    </ProfessionalStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user
        ? <AuthNavigator />
        : user.role === 'professional'
          ? <ProfessionalNavigator />
          : <ResidentNavigator />}
    </NavigationContainer>
  );
}
