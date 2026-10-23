import { useEffect, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getAllDailyLogs,
  getDailyLog,
  saveDailyLog,
} from '@/db/dailyLogRepository';
import type { FlowLevel } from '@/types/period';
import {
  changeDate,
  formatDisplayDate,
  formatStorageDate,
} from '@/utils/dateUtils';



export default function LogScreen() {
  const [isPeriod, setIsPeriod] = useState(false);

  const [flow, setFlow] = useState<FlowLevel>('Light');

  const [selectedDate, setSelectedDate] = useState(new Date());
  const goToPreviousDay = () => {
    setSelectedDate(current => changeDate(current, -1));
  
  };

  const goToNextDay = () => {
    setSelectedDate(current => changeDate(current, 1));
  };


  useEffect(() => {
    try {
      // Convert selected date to database format
      const date = formatStorageDate(selectedDate);

      // Retrieve the saved record
      const savedLog = getDailyLog(date);

      if (savedLog) {
        setIsPeriod(savedLog.bleeding_status === 'period');
        setFlow(savedLog.flow ?? 'Light');
      } else {
        setIsPeriod(false);
        setFlow('Light');
      }

    } catch (error) {
      console.error('Database initialization/loading error:', error);

      Alert.alert(
        'Database Error',
        'Could not load your period information.'
      );
    }
  }, [selectedDate]);
  
  const handleSave = () => {
    try {
      const date = formatStorageDate(selectedDate);

      saveDailyLog(
        date,
        isPeriod,
        isPeriod ? flow : null
      );
      const allLogs = getAllDailyLogs();

      console.log('Saved daily logs:', allLogs);

      Alert.alert(
        'Saved!',
        'Your daily log has been saved successfully.'
      );
    } catch (error) {
      console.error('Error saving daily log:', error);

      Alert.alert(
        'Error',
        'Could not save your daily log.'
      );
    }
  };



  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Daily Log 🌷</Text>

      <Text style={styles.subtitle}>
        Record how you're feeling today.
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
        <Text style={styles.label}>
          Are you on your period?
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.button,
              isPeriod && styles.selectedButton,
            ]}
            onPress={() => setIsPeriod(true)}
          >
            <Text style={styles.buttonText}>Yes</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              !isPeriod && styles.selectedButton,
            ]}
            onPress={() => setIsPeriod(false)}
          >
            <Text style={styles.buttonText}>No</Text>
          </Pressable>
        </View>

        {isPeriod && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Flow intensity
            </Text>

            <View style={styles.row}>
              {(['Light', 'Medium', 'Heavy'] as const).map(
                (level) => (
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
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Today's summary</Text>

        <Text>Period: {isPeriod ? 'Yes' : 'No'}</Text>

        {isPeriod && <Text>Flow: {flow}</Text>}
      </View>
      
      <Pressable
        style={styles.saveButton}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>
          Save Daily Log
        </Text>
      </Pressable>

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
  section: {
    marginTop: 15,
    gap: 10,
  },
  /*calendar */
  
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
saveButton: {
  backgroundColor: '#D65A87',
  padding: 16,
  borderRadius: 12,
  alignItems: 'center',
  marginBottom: 40,
},

saveButtonText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 'bold',
},
});
