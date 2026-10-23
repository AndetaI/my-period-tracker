
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { useFocusEffect } from 'expo-router';

import {
  getAllPeriods,
  type Period,
} from '@/db/repositories/periodRepository';

import { getUserSettings } from '@/db/repositories/settingsRepository';

import { savePeriodRange } from '@/services/cycleService';

import {
  createPeriodSelection,
  isDateSelected,
  updatePeriodSelection,
  type PeriodSelection,
} from '@/utils/periodSelection';

import { formatStorageDate } from '@/utils/dateUtils';

const WEEKDAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];
const CURRENT_MONTH_INDEX = 12;

const DAY_CELL_HEIGHT = 46;
const MONTH_HEIGHT = 390;
export default function CalendarScreen() {
  const calendarListRef = useRef<FlatList<Date>>(null);
  const [savedPeriods, setSavedPeriods] = useState<Period[]>([]);

  const [defaultDuration, setDefaultDuration] = useState(5);

  const [selection, setSelection] =
    useState<PeriodSelection | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Generate 12 previous months, the current month,
  // and 12 future months.
  const months = useMemo(() => {
    const today = new Date();
    const result: Date[] = [];

    for (let offset = -12; offset <= 12; offset++) {
      result.push(
        new Date(
          today.getFullYear(),
          today.getMonth() + offset,
          1
        )
      );
    }

    return result;
  }, []);

  // Load saved periods and settings when opening Calendar.
  useFocusEffect(
    useCallback(() => {
      try {
        const settings = getUserSettings();

        setDefaultDuration(settings.default_period_length);

        setSavedPeriods(getAllPeriods());
      } catch (error) {
        console.error('Error loading calendar:', error);

        Alert.alert(
          'Error',
          'Could not load your calendar data.'
        );
      } finally {
        setIsLoading(false);
      }
    }, [])
  );

  // Check whether a date belongs to a saved period.
  const isSavedPeriodDay = (date: string): boolean => {
    return savedPeriods.some(period => {
      return (
        period.end_date !== null &&
        date >= period.start_date &&
        date <= period.end_date
      );
    });
  };

  // Handle date selection.
  const handleDatePress = (date: string) => {
    if (isLoading) {
      return;
    }

    if (selection === null) {
      setSelection(
        createPeriodSelection(date, defaultDuration)
      );

      return;
    }

    setSelection(
      updatePeriodSelection(
        selection,
        date,
        defaultDuration
      )
    );
  };

  const handleClearSelection = () => {
    setSelection(null);
  };

  // Save selected period to SQLite.
  const handleSave = () => {
    if (!selection || isLoading) {
      return;
    }

    try {
      savePeriodRange(
        selection.startDate,
        selection.endDate,
        defaultDuration
      );

      setSavedPeriods(getAllPeriods());

      setSelection(null);

      Alert.alert(
        'Saved!',
        'Your period dates have been recorded.'
      );
    } catch (error) {
      console.error('Error saving period:', error);

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not save the period.'
      );
    }
  };

  // Calculate actual number of selected days.
  const selectedDuration = selection
    ? Math.round(
        (
          new Date(
            `${selection.endDate}T00:00:00Z`
          ).getTime() -
          new Date(
            `${selection.startDate}T00:00:00Z`
          ).getTime()
        ) / 86400000
      ) + 1
    : 0;

  // Render one month in the FlatList.
  const renderMonth = ({
    item: monthDate,
  }: ListRenderItemInfo<Date>) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const firstDayOfWeek =
      (new Date(year, month, 1).getDay() + 6) % 7;

    const cells: (string | null)[] = [];

    // Empty cells before the first day.
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }

    // Add every day of the month.
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(
        formatStorageDate(
          new Date(year, month, day)
        )
      );
    }

    // Fill the calendar to exactly 6 weeks (42 cells).
    while (cells.length < 42) {
      cells.push(null);
    }

    const monthTitle = monthDate.toLocaleDateString(
      'en-US',
      {
        month: 'long',
        year: 'numeric',
      }
    );

    return (
      <View style={styles.monthSection}>
        <Text style={styles.monthTitle}>
          {monthTitle}
        </Text>

        <View style={styles.calendarGrid}>
          {WEEKDAYS.map((day, index) => (
            <View
              key={`weekday-${index}`}
              style={styles.dayCell}
            >
              <Text style={styles.weekdayText}>
                {day}
              </Text>
            </View>
          ))}

          {cells.map((date, index) => {
            if (date === null) {
              return (
                <View
                  key={`empty-${index}`}
                  style={styles.dayCell}
                />
              );
            }

            const selected = isDateSelected(
              date,
              selection
            );

            const saved = isSavedPeriodDay(date);

            const isToday =
              date === formatStorageDate(new Date());

            return (
              <View
                key={date}
                style={styles.dayCell}
              >
                <Pressable
                  onPress={() => handleDatePress(date)}
                  style={[
                    styles.dayButton,
                    isToday && styles.todayDay,
                    saved && styles.savedPeriodDay,
                    selected && styles.selectedDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isToday && styles.todayText,
                      selected && styles.selectedDayText,
                    ]}
                  >
                    {Number(date.slice(8, 10))}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* FIXED HEADER */}

      <View style={styles.header}>
        <Text style={styles.title}>
          Calendar 🌸
        </Text>

        <Text style={styles.subtitle}>
          Scroll through months and select your period dates.
        </Text>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendColor} />
            <Text style={styles.hintText}>
              Selected
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={styles.savedLegendColor} />
            <Text style={styles.hintText}>
              Saved period
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View style={styles.todayLegendColor} />
            <Text style={styles.hintText}>
              Today
            </Text>
          </View>
        </View>
      </View>

      {/* VERTICALLY SCROLLABLE MONTHS */}

      
      <FlatList
        ref={calendarListRef}
        data={months}
        keyExtractor={item =>
          `${item.getFullYear()}-${item.getMonth()}`
        }
        renderItem={renderMonth}
        initialScrollIndex={CURRENT_MONTH_INDEX}
        getItemLayout={(_, index) => ({
          length: MONTH_HEIGHT + 14,
          offset: (MONTH_HEIGHT + 14) * index,
          index,
        })}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        style={styles.monthList}
        contentContainerStyle={styles.monthListContent}
        extraData={{ selection, savedPeriods }}
      />


      {/* FIXED BOTTOM PANEL */}

      <View style={styles.bottomPanel}>
        {selection ? (
          <View>
            <Text style={styles.selectionTitle}>
              Selected Period
            </Text>

            <Text style={styles.selectionSummary}>
              {selection.startDate} → {selection.endDate}
            </Text>

            <Text style={styles.durationText}>
              {selectedDuration} days selected
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.selectionTitle}>
              Period Selection
            </Text>

            <Text style={styles.selectionSummary}>
              Tap a date to select your period.
            </Text>

            <Text style={styles.durationText}>
              Default duration: {defaultDuration} days
            </Text>
          </View>
        )}

        <View style={styles.bottomActions}>
          {selection && (
            <Pressable
              onPress={handleClearSelection}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>
                Clear
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSave}
            disabled={!selection || isLoading}
            style={[
              styles.saveButton,
              (!selection || isLoading) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.saveButtonText}>
              Save Period
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F8',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#FFF5F8',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#D65A87',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 14,
    lineHeight: 22,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#D65A87',
  },

  savedLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#F5DCE5',
  },

  todayLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D65A87',
  },

  hintText: {
    fontSize: 12,
    color: '#777',
  },

  monthList: {
    flex: 1,
  },

  monthListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  monthSection: {
    height: MONTH_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  monthTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#D65A87',
    marginBottom: 12,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    width: '14.2857%',
    height: DAY_CELL_HEIGHT,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },

  dayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    fontSize: 15,
    color: '#333',
  },

  selectedDay: {
    backgroundColor: '#D65A87',
  },

  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  savedPeriodDay: {
    backgroundColor: '#F5DCE5',
  },

  todayDay: {
    borderWidth: 2,
    borderColor: '#D65A87',
  },

  todayText: {
    fontWeight: 'bold',
  },

  bottomPanel: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#F5DCE5',
  },

  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D65A87',
    marginBottom: 5,
  },

  selectionSummary: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
  },

  durationText: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
    marginBottom: 12,
  },

  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#FFF5F8',
  },

  clearButtonText: {
    color: '#D65A87',
    fontWeight: '600',
  },

  saveButton: {
    flex: 1,
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
