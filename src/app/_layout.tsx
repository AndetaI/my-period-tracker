import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import {
  initDatabase,
  inspectDatabase,
} from '@/db/database';

type DatabaseStatus = 'loading' | 'ready' | 'error';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [status, setStatus] =
    useState<DatabaseStatus>('loading');

  
  const initialize = useCallback(() => {
    setStatus('loading');

    try {
      initDatabase();

      if (__DEV__) {
        inspectDatabase();
      }

      console.log('Database initialized successfully');

      setStatus('ready');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Database error:', error.message);
        console.error('Stack:', error.stack);
      } else {
        console.error('Unknown database error:', error);
      }

      setStatus('error');
    }
  }, []);


  useEffect(() => {
    initialize();
  }, [initialize]);

  if (status === 'loading') {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <ActivityIndicator size="large" />
        <Text>Preparing your data...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
      }}>
        <Text>Could not initialize the database.</Text>
        <Button title="Retry" onPress={initialize} />
      </View>
    );
  }

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
