import type { MoodLevel } from '@/db/repositories/dailyLogRepository';
import { useEffect, useState } from 'react';
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
import { useCallback } from 'react';

import { getDailyLog } from '@/db/repositories/dailyLogRepository';
import { getPeriodForDate } from '@/db/repositories/periodRepository';

import type { FlowLevel } from '@/types/period';

import {
  changeDate,
  formatDisplayDate,
  formatStorageDate,
} from '@/utils/dateUtils';

export default function LogScreen() {

    const symptomOptions = [
    'Cramps',
    'Headache',
    'Bloating',
    'Back Pain',
    'Breast Tenderness',
    'Fatigue',
    'Acne',
    'Nausea',
  ] as const;

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(current =>
      current.includes(symptom)
        ? current.filter(item => item !== symptom)
        : [...current, symptom]
    );
  };

  const [selectedSymptoms, setSelectedSymptoms] =
    useState<string[]>([]);

  const [mood, setMood] =
    useState<MoodLevel | null>(null);

  const [notes, setNotes] = useState('');

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isRecordedPeriodDay, setIsRecordedPeriodDay] =
    useState(false);

  const [flow, setFlow] = useState<FlowLevel>('Light');

  const loadDailyInformation = useCallback(() => {
    try {
      const date = formatStorageDate(selectedDate);

      const period = getPeriodForDate(date);
      const savedLog = getDailyLog(date);

      setIsRecordedPeriodDay(period !== null);
      setFlow(savedLog?.flow ?? 'Light');
    } catch (error) {
      console.error('Error loading daily information:', error);

      Alert.alert(
        'Error',
        'Could not load daily information.'
      );
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDailyInformation();
  }, [loadDailyInformation]);

  useFocusEffect(
    useCallback(() => {
      loadDailyInformation();
    }, [loadDailyInformation])
  );

  const goToPreviousDay = () => {
    setSelectedDate(current => changeDate(current, -1));
  };

  const goToNextDay = () => {
    setSelectedDate(current => changeDate(current, 1));
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Daily Log 🌷</Text>

      <Text style={styles.subtitle}>
        Record your daily symptoms and how you're feeling.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Select date</Text>

        <View style={styles.dateRow}>
          <Pressable
            onPress={goToPreviousDay}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Text style={styles.dateButtonText}>‹</Text>
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
            <Text style={styles.dateButtonText}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Period status</Text>

        <Text style={styles.infoText}>
          {isRecordedPeriodDay
            ? '🌸 This date belongs to a recorded period.'
            : 'No recorded period for this date.'}
        </Text>

        <Text style={styles.hintText}>
          Period dates are managed in the Calendar tab.
        </Text>
      </View>

      {isRecordedPeriodDay && (
        <View style={styles.card}>
          <Text style={styles.label}>Flow intensity</Text>

          <View style={styles.row}>
            {(['Light', 'Medium', 'Heavy'] as const).map(
              level => (
                <Pressable
                  key={level}
                  style={[
                    styles.button,
                    flow === level && styles.selectedButton,
                  ]}
                  onPress={() => setFlow(level)}
                >
                  <Text style={styles.buttonText}>
                    {level}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>
      )}

      
      <View style={styles.card}>
        <Text style={styles.label}>Daily Symptoms 🌼</Text>

        <Text style={styles.hintText}>
          Select any symptoms you experienced on this date.
        </Text>

        <View style={styles.symptomsGrid}>
          {symptomOptions.map(symptom => {
            const selected = selectedSymptoms.includes(symptom);

            return (
              <Pressable
                key={symptom}
                onPress={() => toggleSymptom(symptom)}
                style={[
                  styles.symptomChip,
                  selected && styles.selectedSymptomChip,
                ]}
              >
                <Text
                  style={[
                    styles.symptomText,
                    selected && styles.selectedSymptomText,
                  ]}
                >
                  {symptom}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Mood 💗</Text>

        <View style={styles.symptomsGrid}>
          {(['Happy', 'Normal', 'Sad', 'Irritable'] as const).map(
            option => (
              <Pressable
                key={option}
                onPress={() =>
                  setMood(current =>
                    current === option ? null : option
                  )
                }
                style={[
                  styles.symptomChip,
                  mood === option && styles.selectedSymptomChip,
                ]}
              >
                <Text
                  style={[
                    styles.symptomText,
                    mood === option && styles.selectedSymptomText,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Notes 📝</Text>

        <TextInput
          style={styles.notesInput}
          multiline
          placeholder="How are you feeling today?"
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
      </View>


      <View style={styles.card}>
        <Text style={styles.label}>Daily summary</Text>

        <Text style={styles.infoText}>
          Recorded period: {isRecordedPeriodDay ? 'Yes' : 'No'}
        </Text>

        {isRecordedPeriodDay && (
          <Text style={styles.infoText}>
            Flow: {flow}
          </Text>
        )}
      </View>

      <Text style={styles.hintText}>
        Daily symptom saving will be connected in the next step.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F8',
    padding: 20,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  infoText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  hintText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 15,
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
});
