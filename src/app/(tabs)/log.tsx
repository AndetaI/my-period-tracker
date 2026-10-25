
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

const WEEKDAY_LABELS = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

function getWeekDates(selectedDate: Date): Date[] {
  const mondayOffset =
    (selectedDate.getDay() + 6) % 7;

  const monday = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate() - mondayOffset
  );

  return Array.from({ length: 7 }, (_, index) => {
    return new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index
    );
  });
}

interface DailyLogSnapshot {
  flow: FlowLevel | null;
  mood: MoodLevel | null;
  notes: string;
  symptomIds: number[];
}


export default function LogScreen() {
  // --------------------------------------------------
  // STATE
  // --------------------------------------------------
  const [savedSnapshot, setSavedSnapshot] =
    useState<DailyLogSnapshot | null>(null);
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
    setSavedSnapshot(null);
    setIsLoading(true);

    try {
      const date = formatStorageDate(selectedDate);

      // Period information comes from Calendar records.
      const period = getPeriodForDate(date);

      // Daily observations come from daily_logs.
      const details = getDailyLogDetails(date);

      const loadedSnapshot: DailyLogSnapshot = {
        flow: period !== null
          ? details.log?.flow ?? 'Light'
          : null,
        mood: details.log?.mood ?? null,
        notes: details.log?.notes ?? '',
        symptomIds: details.symptoms
          .map(symptom => symptom.id)
          .sort((a, b) => a - b),
      };

      setSavedSnapshot(loadedSnapshot);

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

 
  const goToPreviousWeek = () => {
    setSelectedDate(current =>
      changeDate(current, -7)
    );
  };

  const goToNextWeek = () => {
    setSelectedDate(current =>
      changeDate(current, 7)
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



    
  const currentSnapshot: DailyLogSnapshot = {
    flow: isRecordedPeriodDay ? flow : null,
    mood,
    notes,
    symptomIds: [...selectedSymptomIds].sort(
      (a, b) => a - b
    ),
  };

  const hasChanges =
    savedSnapshot !== null &&
    JSON.stringify(currentSnapshot) !==
      JSON.stringify(savedSnapshot);

  const canSave = !isLoading && hasChanges;

  // --------------------------------------------------
  // SAVE DAILY LOG
  // --------------------------------------------------

  const handleSave = () => {
    if (canSave) {
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
      setSavedSnapshot(currentSnapshot);

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

      {/* WEEKLY DATE SELECTION */}

      <View style={styles.card}>
        <View style={styles.weekHeader}>
          <Text style={styles.label}>
            Select date
          </Text>

          <View style={styles.weekNavigation}>
            <Pressable
              onPress={goToPreviousWeek}
              style={styles.weekNavButton}
              accessibilityRole="button"
              accessibilityLabel="Previous week"
            >
              <Text style={styles.weekNavText}>‹</Text>
            </Pressable>

            <Pressable
              onPress={goToNextWeek}
              style={styles.weekNavButton}
              accessibilityRole="button"
              accessibilityLabel="Next week"
            >
              <Text style={styles.weekNavText}>›</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.selectedDateText}>
          {formatDisplayDate(selectedDate)}
        </Text>

        <View style={styles.weekRow}>
          {getWeekDates(selectedDate).map((date, index) => {
            const isSelected =
              formatStorageDate(date) ===
              formatStorageDate(selectedDate);

            return (
              <Pressable
                key={formatStorageDate(date)}
                onPress={() => setSelectedDate(date)}
                style={[
                  styles.weekDay,
                  isSelected && styles.selectedWeekDay,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={formatDisplayDate(date)}
              >
                <Text
                  style={[
                    styles.weekDayLabel,
                    isSelected && styles.selectedWeekText,
                  ]}
                >
                  {WEEKDAY_LABELS[index]}
                </Text>

                <Text
                  style={[
                    styles.weekDayNumber,
                    isSelected && styles.selectedWeekText,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
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
        <Text style={styles.saveButtonText}>
          {isLoading ? 'Loading...' : 'Save Daily Log'}
        </Text>
      </Pressable>

    </ScrollView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({

  pressedButton: {
    backgroundColor: '#B94370',
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
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
  backgroundColor: '#F5DCE5',
  opacity: 1,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
weekHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

weekNavigation: {
  flexDirection: 'row',
  gap: 8,
},

weekNavButton: {
  backgroundColor: '#F5DCE5',
  width: 34,
  height: 34,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
},

weekNavText: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#D65A87',
},

selectedDateText: {
  fontSize: 14,
  fontWeight: '500',
  color: '#888',
},

weekRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 5,
},

weekDay: {
  flex: 1,
  backgroundColor: '#FFF5F8',
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: 'center',
  gap: 8,
},

selectedWeekDay: {
  backgroundColor: '#D65A87',
},

weekDayLabel: {
  fontSize: 11,
  color: '#888',
  fontWeight: '500',
},

weekDayNumber: {
  fontSize: 16,
  color: '#333',
  fontWeight: '600',
},

selectedWeekText: {
  color: '#FFFFFF',
},

});
