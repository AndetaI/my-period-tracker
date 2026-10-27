import {
  exportEncryptedBackup,
  saveEncryptedBackupToDevice,
} from '@/services/backupService';

import {
  selectAndDecryptBackup,
} from '@/services/restoreService';

import { exportBackup, saveBackupToDevice } from '@/services/backupService';
import {
  applyBackup,
  selectAndValidateBackup,
  type SelectedBackup,
} from '@/services/restoreService';
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

interface SettingsSnapshot {
  cycleLength: string;
  periodDuration: string;
}

export default function SettingsScreen() {
  const [backupPassword, setBackupPassword] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const handleExportBackup = async () => {
    if (isExporting || isRestoring || backupBusy) return;

    setIsExporting(true);

    try {
      await exportBackup();
    } catch (error) {
      Alert.alert(
        'Backup error',
        error instanceof Error
          ? error.message
          : 'Could not export backup.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [cycleLength, setCycleLength] = useState('28');
  const [periodDuration, setPeriodDuration] = useState('5');

  const [savedSettings, setSavedSettings] =
    useState<SettingsSnapshot | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // --------------------------------------------------
  // LOAD SETTINGS
  // --------------------------------------------------

  const loadSettings = useCallback(() => {
    setIsLoading(true);
    setSavedSettings(null);

    try {
      const settings = getUserSettings();

      const loadedCycleLength = String(
        settings.default_cycle_length
      );

      const loadedPeriodDuration = String(
        settings.default_period_length
      );

      setCycleLength(loadedCycleLength);
      setPeriodDuration(loadedPeriodDuration);

      // Remember the original saved values.
      setSavedSettings({
        cycleLength: loadedCycleLength,
        periodDuration: loadedPeriodDuration,
      });
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

  // --------------------------------------------------
  // DETECT UNSAVED CHANGES
  // --------------------------------------------------

  const hasChanges =
    savedSettings !== null &&
    (
      cycleLength !== savedSettings.cycleLength ||
      periodDuration !== savedSettings.periodDuration
    );

  const canSave = !isLoading && hasChanges;

    
  const handleRestoreBackup = async () => {
    if (isRestoring || isExporting || backupBusy) return;

    setIsRestoring(true);

    let selected: SelectedBackup | null = null;

    try {
      selected = await selectAndValidateBackup();

      if (!selected) {
        setIsRestoring(false);
        return;
      }

      const backup = selected;

      Alert.alert(
        'Restore Backup',
        `Restore "${backup.name}"?\n\n` +
        'This will replace your current period history, ' +
        'daily logs, and settings with the backup data.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: async () => {
              await backup.close();
              setIsRestoring(false);
            },
          },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await applyBackup(backup);

                // Reload the Settings fields from the
                // newly restored database.
                loadSettings();

                Alert.alert(
                  'Restore completed',
                  'Your backup has been restored. ' +
                  'Reopen the other tabs to refresh their data.'
                );
              } catch (error) {
                Alert.alert(
                  'Restore failed',
                  error instanceof Error
                    ? error.message
                    : 'Could not restore the backup.'
                );
              } finally {
                await backup.close();
                setIsRestoring(false);
              }
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch (error) {
      if (selected) {
        await selected.close();
      }

      setIsRestoring(false);

      Alert.alert(
        'Invalid backup',
        error instanceof Error
          ? error.message
          : 'Could not read the selected file.'
      );
    }
  };


  async function handleEncryptedExport() {
    if (backupBusy || isExporting || isRestoring) return;
    if (backupPassword.length < 12) {
      Alert.alert('Password required', 'Use at least 12 characters.');
      return;
    }

    setBackupBusy(true);
    try {
      await exportEncryptedBackup(backupPassword);
      Alert.alert(
        'Backup prepared',
        'Check that you actually saved the encrypted .ptbackup file.'
      );
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBackupPassword('');
      setBackupBusy(false);
    }
  }

  async function handleEncryptedSave() {
    if (backupBusy || isExporting || isRestoring) return;
    if (backupPassword.length < 12) {
      Alert.alert('Password required', 'Use at least 12 characters.');
      return;
    }

    setBackupBusy(true);
    try {
      const saved = await saveEncryptedBackupToDevice(backupPassword);
      if (saved) Alert.alert('Backup saved', 'Encrypted backup saved to your chosen folder.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBackupPassword('');
      setBackupBusy(false);
    }
  }

  async function handleEncryptedRestore() {
    if (backupBusy || isExporting || isRestoring) return;
    if (!backupPassword) {
      Alert.alert('Password required', 'Enter the password used for this backup.');
      return;
    }

    setBackupBusy(true);
    let selected: SelectedBackup | null = null;

    // Each confirmation button is responsible for closing the candidate database.
    const finish = async (backup: SelectedBackup) => {
      try {
        await backup.close();
      } catch (error) {
        console.warn('Encrypted restore cleanup failed:', error);
      } finally {
        setBackupPassword('');
        setBackupBusy(false);
      }
    };

    try {
      selected = await selectAndDecryptBackup(backupPassword);
      if (!selected) {
        setBackupPassword('');
        setBackupBusy(false);
        return;
      }

      const backup = selected;
      Alert.alert(
        'Restore encrypted backup?',
        `Restore "${backup.name}"?\n\nThis replaces current periods, logs, and settings.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => { void finish(backup); },
          },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await applyBackup(backup);
                  loadSettings();
                  Alert.alert(
                    'Restore complete',
                    'Your encrypted backup was restored. Reopen other tabs to refresh their data.'
                  );
                } catch (error) {
                  Alert.alert(
                    'Restore failed',
                    error instanceof Error ? error.message : 'Unknown error'
                  );
                } finally {
                  await finish(backup);
                }
              })();
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      if (selected) await finish(selected);
      else {
        setBackupPassword('');
        setBackupBusy(false);
      }
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // --------------------------------------------------
  // SAVE SETTINGS
  // --------------------------------------------------

  const handleSave = () => {
    if (!canSave) {
      return;
    }

    try {
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

      const cycle = Number(cycleLength);
      const duration = Number(periodDuration);

      // Save using the existing repository.
      saveUserSettings(cycle, duration);

      // Read back the saved values to ensure
      // our snapshot matches the database.
      const updatedSettings = getUserSettings();

      const savedCycleLength = String(
        updatedSettings.default_cycle_length
      );

      const savedPeriodDuration = String(
        updatedSettings.default_period_length
      );

      setCycleLength(savedCycleLength);
      setPeriodDuration(savedPeriodDuration);

      setSavedSettings({
        cycleLength: savedCycleLength,
        periodDuration: savedPeriodDuration,
      });

      Keyboard.dismiss();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not save settings.'
      );
    }
  };

    const handleSaveBackupToDevice = async () => {
    if (isExporting || isRestoring || backupBusy) return;

    setIsExporting(true);

    try {
      const saved = await saveBackupToDevice();

      if (saved) {
        Alert.alert(
          'Backup saved',
          'Your backup was saved to the selected folder.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Backup error',
        error instanceof Error
          ? error.message
          : 'Could not save the backup.'
      );
    } finally {
      setIsExporting(false);
    }
  };


  // --------------------------------------------------
  // SCREEN
  // --------------------------------------------------

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
          Average cycle length
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
          to the start of the next, permitted range of
          15–90 days.
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

            
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Data & Backup</Text>
        <Text style={styles.infoText}>
          Protect your period history with a password-encrypted backup.
        </Text>

        <Text style={styles.label}>Backup password</Text>
        <TextInput
          style={styles.input}
          value={backupPassword}
          onChangeText={setBackupPassword}
          placeholder="Enter password (12+ characters)"
          placeholderTextColor="#999999"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!backupBusy}
          accessibilityLabel="Backup password"
        />
        <Text style={styles.hint}>
          Remember this password. Without it, you cannot restore an encrypted backup.
          Your password is not saved by the app.
        </Text>

        <Pressable
          onPress={handleEncryptedSave}
          disabled={backupBusy || isExporting || isRestoring}
          style={({ pressed }) => [
            styles.backupButton,
            (backupBusy || isExporting || isRestoring) && styles.disabledButton,
            pressed && !backupBusy && !isExporting && !isRestoring && styles.pressedButton,
          ]}
        >
          <Text style={styles.backupButtonText}>
            {backupBusy ? 'Please wait...' : 'Save Encrypted Backup'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleEncryptedExport}
          disabled={backupBusy || isExporting || isRestoring}
          style={({ pressed }) => [
            styles.backupButton,
            (backupBusy || isExporting || isRestoring) && styles.disabledButton,
            pressed && !backupBusy && !isExporting && !isRestoring && styles.pressedButton,
          ]}
        >
          <Text style={styles.backupButtonText}>Share Encrypted Backup</Text>
        </Pressable>

        <Pressable
          onPress={handleEncryptedRestore}
          disabled={backupBusy || isExporting || isRestoring}
          style={({ pressed }) => [
            styles.backupButton,
            (backupBusy || isExporting || isRestoring) && styles.disabledButton,
            pressed && !backupBusy && !isExporting && !isRestoring && styles.pressedButton,
          ]}
        >
          <Text style={styles.backupButtonText}>Restore Encrypted Backup</Text>
        </Pressable>

        <View style={styles.legacySection}>
          <Text style={styles.label}>Legacy backups (.db)</Text>
          <Text style={styles.hint}>
            These older backups are NOT encrypted. Keep them private and use them
            only for migration or recovery.
          </Text>

          <Pressable
            onPress={handleRestoreBackup}
            disabled={isRestoring || isExporting || backupBusy}
            style={({ pressed }) => [
              styles.backupButton,
              (isRestoring || isExporting || backupBusy) && styles.disabledButton,
              pressed && !isRestoring && !isExporting && !backupBusy && styles.pressedButton,
            ]}
          >
            <Text style={styles.backupButtonText}>
              {isRestoring ? 'Restoring...' : 'Restore Legacy Backup'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSaveBackupToDevice}
            disabled={isExporting || isRestoring || backupBusy}
            style={({ pressed }) => [
              styles.backupButton,
              (isExporting || isRestoring || backupBusy) && styles.disabledButton,
              pressed && !isExporting && !isRestoring && !backupBusy && styles.pressedButton,
            ]}
          >
            <Text style={styles.backupButtonText}>Save Legacy Backup</Text>
          </Pressable>

          <Pressable
            onPress={handleExportBackup}
            disabled={isExporting || isRestoring || backupBusy}
            style={({ pressed }) => [
              styles.backupButton,
              (isExporting || isRestoring || backupBusy) && styles.disabledButton,
              pressed && !isExporting && !isRestoring && !backupBusy && styles.pressedButton,
            ]}
          >
            <Text style={styles.backupButtonText}>
              {isExporting ? 'Preparing Backup...' : 'Share Legacy Backup'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* SAVE BUTTON */}

            
      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && styles.disabledButton,
          pressed && canSave && styles.pressedButton,
        ]}
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
      >
        <Text
          style={[
            styles.saveButtonText,
            !canSave && styles.disabledButtonText,
          ]}
        >
          Save Settings
        </Text>
      </Pressable>

    </ScrollView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  legacySection: {
    borderTopWidth: 1,
    borderTopColor: '#F5DCE5',
    paddingTop: 16,
    marginTop: 6,
    gap: 12,
  },
  backupButton: {
    backgroundColor: '#D65A87',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  backupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF5F8',
    paddingTop:30,
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
  pressedButton: {
    backgroundColor: '#B94370',
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },

  disabledButton: {
    backgroundColor: '#F5DCE5',
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  disabledButtonText: {
    color: '#B17B91',
  },
});
