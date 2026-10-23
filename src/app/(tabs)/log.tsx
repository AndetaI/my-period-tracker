
import { useCallback, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import type {
  MoodLevel,
} from '@/db/repositories/dailyLogRepository';

import {
  getPeriodForDate,
} from '@/db/repositories/periodRepository';

import {
  getAllSymptoms,
  type Symptom,
} from '@/db/repositories/symptomRepository';

import {
  getDailyLogDetails,
  saveDailyLogDetails,
} from '@/services/dailyLogService';

import type { FlowLevel } from '@/types/period';

import {
  changeDate,
  formatDisplayDate,
  formatStorageDate,
} from '@/utils/dateUtils';

export default function LogScreen() {
  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [selectedDate, setSelectedDate] = useState(
    new Date()
  );

  const [isRecordedPeriodDay, setIsRecordedPeriodDay] =
    useState(false);

  const [flow, setFlow] =
    useState<FlowLevel>('Light');

  const [mood, setMood] =
    useState<MoodLevel | null>(null);

  const [notes, setNotes] = useState('');

  const [availableSymptoms, setAvailableSymptoms] =
    useState<Symptom[]>([]);

  const [selectedSymptomIds, setSelectedSymptomIds] =
    useState<number[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // --------------------------------------------------
  // LOAD DAILY INFORMATION
  // --------------------------------------------------

  const loadDailyInformation = useCallback(() => {
    setIsLoading(true);

    try {
      const date = formatStorageDate(selectedDate);

      // Period information comes from Calendar records.
      const period = getPeriodForDate(date);

      // Daily observations come from daily_logs.
      const details = getDailyLogDetails(date);

      // Available symptoms come from the symptoms table.
      const symptoms = getAllSymptoms();

      setIsRecordedPeriodDay(period !== null);

      setFlow(details.log?.flow ?? 'Light');

      setMood(details.log?.mood ?? null);

      setNotes(details.log?.notes ?? '');

      setAvailableSymptoms(symptoms);

      setSelectedSymptomIds(
        details.symptoms.map(symptom => symptom.id)
      );
    } catch (error) {
      console.error(
        'Error loading daily information:',
        error
      );

      Alert.alert(
        'Error',
        'Could not load daily information.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  // Refresh when entering the Log tab or changing dates.
  useFocusEffect(
    useCallback(() => {
      loadDailyInformation();
    }, [loadDailyInformation])
  );

  // --------------------------------------------------
  // DATE NAVIGATION
  // --------------------------------------------------

  const goToPreviousDay = () => {
    setSelectedDate(current =>
      changeDate(current, -1)
    );
  };

  const goToNextDay = () => {
    setSelectedDate(current =>
      changeDate(current, 1)
    );
  };

  // --------------------------------------------------
  // SYMPTOM SELECTION
  // --------------------------------------------------

  const toggleSymptom = (symptomId: number) => {
    setSelectedSymptomIds(current =>
      current.includes(symptomId)
        ? current.filter(id => id !== symptomId)
        : [...current, symptomId]
    );
  };

  // --------------------------------------------------
  // SAVE DAILY LOG
  // --------------------------------------------------

  const handleSave = () => {
    if (isLoading) {
      return;
    }

    try {
      const date = formatStorageDate(selectedDate);

      saveDailyLogDetails({
        date,
        flow: isRecordedPeriodDay ? flow : null,
        mood,
        notes,
        symptomIds: selectedSymptomIds,
      });

      Alert.alert(
        'Saved!',
        'Your daily observations have been saved successfully.'
      );
    } catch (error) {
      console.error(
        'Error saving daily observations:',
        error
      );

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not save daily observations.'
      );
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
        Daily Log 🌷
      </Text>

      <Text style={styles.subtitle}>
        Record your daily symptoms and how you're feeling.
      </Text>

      {/* DATE SELECTION */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Select date
        </Text>

        <View style={styles.dateRow}>
          <Pressable
            onPress={goToPreviousDay}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Text style={styles.dateButtonText}>
              ‹
            </Text>
          </Pressable>

          <Text style={styles.dateText}>
            {formatDisplayDate(selectedDate)}
          </Text>

          <Pressable
            onPress={goToNextDay}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Text style={styles.dateButtonText}>
              ›
            </Text>
          </Pressable>
        </View>
      </View>

      {/* PERIOD STATUS */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Period Status 🌸
        </Text>

        <Text style={styles.infoText}>
          {isRecordedPeriodDay
            ? 'This date belongs to a recorded period.'
            : 'No recorded period for this date.'}
        </Text>

        <Text style={styles.hintText}>
          Period dates are managed in the Calendar tab.
        </Text>
      </View>

      {/* FLOW INTENSITY */}

      {isRecordedPeriodDay && (
        <View style={styles.card}>
          <Text style={styles.label}>
            Flow Intensity
          </Text>

          <View style={styles.row}>
            {(
              ['Light', 'Medium', 'Heavy'] as const
            ).map(level => (
              <Pressable
                key={level}
                style={[
                  styles.button,
                  flow === level &&
                    styles.selectedButton,
                ]}
                onPress={() => setFlow(level)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    flow === level &&
                      styles.selectedButtonText,
                  ]}
                >
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* DAILY SYMPTOMS */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Daily Symptoms 🌼
        </Text>

        <Text style={styles.hintText}>
          Select any symptoms you experienced on this date.
        </Text>

        <View style={styles.symptomsGrid}>
          {availableSymptoms.map(symptom => {
            const selected =
              selectedSymptomIds.includes(symptom.id);

            return (
              <Pressable
                key={symptom.id}
                onPress={() =>
                  toggleSymptom(symptom.id)
                }
                style={[
                  styles.symptomChip,
                  selected &&
                    styles.selectedSymptomChip,
                ]}
              >
                <Text
                  style={[
                    styles.symptomText,
                    selected &&
                      styles.selectedSymptomText,
                  ]}
                >
                  {symptom.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {availableSymptoms.length === 0 && (
          <Text style={styles.hintText}>
            No symptoms available.
          </Text>
        )}
      </View>

      {/* MOOD */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Mood 💗
        </Text>

        <View style={styles.symptomsGrid}>
          {(
            [
              'Happy',
              'Normal',
              'Sad',
              'Irritable',
            ] as const
          ).map(option => {
            const selected = mood === option;

            return (
              <Pressable
                key={option}
                onPress={() =>
                  setMood(current =>
                    current === option
                      ? null
                      : option
                  )
                }
                style={[
                  styles.symptomChip,
                  selected &&
                    styles.selectedSymptomChip,
                ]}
              >
                <Text
                  style={[
                    styles.symptomText,
                    selected &&
                      styles.selectedSymptomText,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* NOTES */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Notes 📝
        </Text>

        <TextInput
          style={styles.notesInput}
          multiline
          maxLength={2000}
          placeholder="How are you feeling today?"
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />

        <Text style={styles.characterCount}>
          {notes.length}/2000
        </Text>
      </View>

      {/* DAILY SUMMARY */}

      <View style={styles.card}>
        <Text style={styles.label}>
          Daily Summary
        </Text>

        <Text style={styles.infoText}>
          Period: {isRecordedPeriodDay ? 'Yes' : 'No'}
        </Text>

        {isRecordedPeriodDay && (
          <Text style={styles.infoText}>
            Flow: {flow}
          </Text>
        )}

        <Text style={styles.infoText}>
          Mood: {mood ?? 'Not selected'}
        </Text>

        <Text style={styles.infoText}>
          Symptoms:{' '}
          {selectedSymptomIds.length > 0
            ? availableSymptoms
                .filter(symptom =>
                  selectedSymptomIds.includes(
                    symptom.id
                  )
                )
                .map(symptom => symptom.name)
                .join(', ')
            : 'None selected'}
        </Text>
      </View>

      {/* SAVE BUTTON */}

      <Pressable
        style={[
          styles.saveButton,
          isLoading && styles.disabledButton,
        ]}
        onPress={handleSave}
        disabled={isLoading}
        accessibilityRole="button"
      >
        <Text style={styles.saveButtonText}>
          {isLoading
            ? 'Loading...'
            : 'Save Daily Log'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

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

  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  row: {
    flexDirection: 'row',
    gap: 10,
  },

  button: {
    flex: 1,
    backgroundColor: '#F5DCE5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  selectedButton: {
    backgroundColor: '#D65A87',
  },

  buttonText: {
    color: '#333',
    fontWeight: '600',
  },

  selectedButtonText: {
    color: '#FFFFFF',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateButton: {
    backgroundColor: '#F5DCE5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },

  dateButtonText: {
    fontSize: 24,
    color: '#D65A87',
    fontWeight: 'bold',
  },

  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flexShrink: 1,
  },

  infoText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },

  hintText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 19,
  },

  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  symptomChip: {
    backgroundColor: '#F5DCE5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },

  selectedSymptomChip: {
    backgroundColor: '#D65A87',
  },

  symptomText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  selectedSymptomText: {
    color: '#FFFFFF',
  },

  notesInput: {
    backgroundColor: '#FFF5F8',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 15,
    color: '#333',
  },

  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },

  saveButton: {
    backgroundColor: '#D65A87',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
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
