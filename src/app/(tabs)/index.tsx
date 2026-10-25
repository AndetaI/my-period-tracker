
import {
  getAllPeriods,
  type Period,
} from '@/db/repositories/periodRepository';
import {
  getCycleHistory,
  getHomeCycleInfo,
  getMyCyclesSummary,
  type CycleHistoryItem,
  type HomeCycleInfo,
  type MyCyclesSummary,
} from '@/services/homeService';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const WEEKDAY_LABELS = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

function getCurrentWeek(): Date[] {
  const today = new Date();

  // Convert Sunday=0 to Monday=0.
  const mondayOffset = (today.getDay() + 6) % 7;

  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - mondayOffset
  );

  return Array.from({ length: 7 }, (_, index) => {
    return new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index
    );
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}



function CycleDots({
  cycle,
}: {
  cycle: CycleHistoryItem;
}) {
  // Avoid rendering an unbounded number of dots.
  const daysToShow = Math.min(cycle.durationDays, 90);

  const start = new Date(
    `${cycle.startDate}T00:00:00Z`
  );

  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: daysToShow }, (_, index) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + index);

        const dateString = date.toISOString().slice(0, 10);

        const isPeriodDay =
          cycle.periodStartDate !== null &&
          dateString >= cycle.periodStartDate &&
          (cycle.periodEndDate === null ||
            dateString <= cycle.periodEndDate);

        return (
          <View
            key={dateString}
            style={[
              styles.cycleDot,
              isPeriodDay && styles.periodDot,
            ]}
          />
        );
      })}
    </View>
  );
}

function formatShortDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export default function HomeScreen() {
const [cyclesSummary, setCyclesSummary] =
  useState<MyCyclesSummary | null>(null);
const [cycleHistory, setCycleHistory] =
  useState<CycleHistoryItem[]>([]);
const [savedPeriods, setSavedPeriods] = useState<Period[]>([]);

  const router = useRouter();

  const [cycleInfo, setCycleInfo] =
    useState<HomeCycleInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [hasError, setHasError] = useState(false);

  // Refresh data whenever Home becomes active.
  useFocusEffect(
    useCallback(() => {
      try {
        setHasError(false);
        setCycleInfo(getHomeCycleInfo());
        setCyclesSummary(getMyCyclesSummary());
        setCycleHistory(getCycleHistory());
        setSavedPeriods(getAllPeriods());
      } catch (error) {
        console.error('Home loading error:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }, [])
  );

  const today = new Date();
  const week = getCurrentWeek();

  const handleLogPeriod = () => {
    router.push('/calendar');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        My Cycle 🌸
      </Text>

      {/* CURRENT WEEK */}

      <View style={styles.weekRow}>
        {week.map((date, index) => {
          const selected = isSameDay(date, today);
          const dateString = formatLocalDate(date);

         const todayString = formatLocalDate(today);

        const isPeriodDay = savedPeriods.some(period =>
          dateString >= period.start_date &&
          dateString <= (period.end_date ?? todayString) &&
          dateString <= todayString
        );

          return (
            <View
              key={index}
              style={[
                styles.dayCard,
                selected && styles.todayCard,
              ]}
            >
              <Text
                style={[
                  styles.weekdayText,
                  selected && styles.todayText,
                ]}
              >
                {WEEKDAY_LABELS[index]}
              </Text>

              <Text
                style={[
                  styles.dayNumber,
                  selected && styles.todayText,
                ]}
              >

                {date.getDate()}
              </Text>
              <View
                style={[
                  styles.weekIndicator,
                  isPeriodDay && styles.weekPeriodIndicator,
                  isPeriodDay && selected && styles.todayPeriodIndicator,
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* CURRENT CYCLE CARD */}

      <View style={styles.cycleCard}>
        <Text style={styles.sectionTitle}>
          Current Cycle
        </Text>

        {isLoading ? (
          <Text style={styles.infoText}>
            Loading your cycle...
          </Text>
        ) : hasError ? (
          <Text style={styles.infoText}>
            Could not load your cycle information.
          </Text>
        ) : cycleInfo ? (
          <>
            <View style={styles.circle}>
              <Text style={styles.circleLabel}>
                You are on
              </Text>

              <Text style={styles.cycleDay}>
                Day {cycleInfo.cycleDay}
              </Text>

              <Text style={styles.circleLabel}>
                of your cycle
              </Text>
            </View>

            <Text style={styles.countdown}>
              {cycleInfo.daysUntilNextPeriod > 0
                ? `${cycleInfo.daysUntilNextPeriod} days until next period`
                : 'Your next period may be due'}
            </Text>

            <Text style={styles.estimateText}>
              Estimated next period: {cycleInfo.nextPeriodDate}
            </Text>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.infoText}>
              No cycle recorded yet.
            </Text>

            <Text style={styles.estimateText}>
              Log your first period to start tracking.
            </Text>
          </View>
        )}

        <Pressable
          style={styles.logButton}
          onPress={handleLogPeriod}
        >
          <Text style={styles.logButtonText}>
            Log Period
          </Text>
        </Pressable>
      </View>
      
      {/* MY CYCLES SUMMARY */}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          My Cycles
        </Text>

        {cyclesSummary && !hasError ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Cycle length
              </Text>
              <Text style={styles.summaryValue}>
                {cyclesSummary.cycleLength !== null
                  ? `${cyclesSummary.cycleLength} days`
                  : '—'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Period length
              </Text>
              <Text style={styles.summaryValue}>
                {cyclesSummary.periodLength !== null
                  ? `${cyclesSummary.periodLength} days`
                  : '—'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Cycle length variation
              </Text>
              <Text style={styles.summaryValue}>
                {cyclesSummary.cycleVariation !== null
                  ? `${cyclesSummary.cycleVariation} days`
                  : 'Not enough history'}
              </Text>
            </View>

            <View style={styles.regularityRow}>
              <Text style={styles.summaryLabel}>
                Cycle pattern
              </Text>

              <Text style={styles.regularityText}>
                {cyclesSummary.regularity}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.infoText}>
            {hasError
              ? 'Could not load cycle summary.'
              : 'Loading cycle summary...'}
          </Text>
        )}
      </View>

            
      {/* CYCLE HISTORY */}

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>
          Cycle History
        </Text>

        {cycleHistory.length === 0 ? (
          <Text style={styles.infoText}>
            No cycles recorded yet.
          </Text>
        ) : (
          cycleHistory.map((cycle, index) => (
            <View
              key={cycle.id}
              style={[
                styles.historyItem,
                index > 0 && styles.historyItemBorder,
              ]}
            >
              <Text style={styles.historyItemTitle}>
                {cycle.status === 'active'
                  ? `Current cycle · Day ${cycle.durationDays}`
                  : `${cycle.durationDays} days`}
              </Text>

              <Text style={styles.historyDates}>
                {cycle.status === 'active'
                  ? `Started ${formatShortDate(cycle.startDate)}`
                  : `${formatShortDate(cycle.startDate)} – ${
                      cycle.endDate
                        ? formatShortDate(cycle.endDate)
                        : 'Ongoing'
                    }`}
              </Text>

              <CycleDots cycle={cycle} />
            </View>
          ))
        )}
      </View>


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
    paddingBottom: 35,
    gap: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#D65A87',
  },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },

  dayCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },

  todayCard: {
    backgroundColor: '#D65A87',
  },

  weekdayText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },

  dayNumber: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },

  todayText: {
    color: '#FFFFFF',
  },

  cycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 18,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#D65A87',
  },

  circle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 9,
    borderColor: '#F2CAD9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },

  circleLabel: {
    fontSize: 13,
    color: '#888',
  },

  cycleDay: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#D65A87',
  },

  countdown: {
    fontSize: 18,
    fontWeight: '600',
    color: '#63394D',
    textAlign: 'center',
  },

  estimateText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },

  infoText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },

  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },

  logButton: {
    backgroundColor: '#D65A87',
    borderRadius: 12,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },

  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },

  summaryTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#D65A87',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5E5EB',
  },

  summaryLabel: {
    fontSize: 14,
    color: '#666',
    flexShrink: 1,
  },

  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#63394D',
  },

  regularityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  regularityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D65A87',
  },
    
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },

  historyTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#D65A87',
  },

  historyItem: {
    paddingVertical: 10,
    gap: 8,
  },

  historyItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F5E5EB',
    paddingTop: 16,
  },

  historyItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#63394D',
  },

  historyDates: {
    fontSize: 13,
    color: '#888',
  },

  dotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },

  cycleDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E5DCE0',
  },

  periodDot: {
    backgroundColor: '#D65A87',
    },
  weekIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },

  weekPeriodIndicator: {
    backgroundColor: '#D65A87',
  },

  todayPeriodIndicator: {
    backgroundColor: '#FFFFFF',
  },

});
