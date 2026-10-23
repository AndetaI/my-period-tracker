
import { useCallback, useState } from 'react';

import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import {
  getUserSettings,
  saveUserSettings,
} from '@/db/repositories/settingsRepository';

export default function SettingsScreen() {
  const [cycleLength, setCycleLength] = useState('28');
  const [periodDuration, setPeriodDuration] = useState('5');

  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(() => {
    try {
      const settings = getUserSettings();

      setCycleLength(
        String(settings.default_cycle_length)
      );

      setPeriodDuration(
        String(settings.default_period_length)
      );
    } catch (error) {
      console.error('Error loading settings:', error);

      Alert.alert(
        'Error',
        'Could not load your settings.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleSave = () => {
    try {
      const cycle = Number(cycleLength);
      const duration = Number(periodDuration);

      if (
        cycleLength.trim() === '' ||
        periodDuration.trim() === ''
      ) {
        Alert.alert(
          'Invalid input',
          'Please enter both values.'
        );
        return;
      }

      saveUserSettings(cycle, duration);

      Keyboard.dismiss();

      Alert.alert(
        'Saved!',
        'Your cycle preferences have been updated.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not save settings.'
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Settings 🌷
      </Text>

      <Text style={styles.subtitle}>
        Personalize your cycle tracking preferences.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Cycle Preferences
        </Text>

        <Text style={styles.label}>
          Average cycle length permitted range of 15–90 days.
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={cycleLength}
          onChangeText={setCycleLength}
          placeholder="28"
          maxLength={2}
        />

        <Text style={styles.hint}>
          Number of days from the start of one period
          to the start of the next.
        </Text>

        <Text style={styles.label}>
          Expected period duration (days)
        </Text>

        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={periodDuration}
          onChangeText={setPeriodDuration}
          placeholder="5"
          maxLength={2}
        />

        <Text style={styles.hint}>
          Used to suggest period dates in Calendar.
          You can select more or fewer days.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          About Predictions
        </Text>

        <Text style={styles.infoText}>
          Your cycle preferences are used to estimate
          future period dates.
        </Text>

        <Text style={styles.infoText}>
          Actual period dates are recorded in Calendar.
          Changing these settings does not change
          previously saved periods.
        </Text>
      </View>

      <Pressable
        style={[
          styles.saveButton,
          isLoading && styles.disabledButton,
        ]}
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          Save Settings
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F8',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#D65A87',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#D65A87',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    backgroundColor: '#FFF5F8',
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: '#333',
    borderWidth: 1,
    borderColor: '#F5DCE5',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    lineHeight: 19,
  },
  infoText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 23,
  },
  saveButton: {
    backgroundColor: '#D65A87',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
