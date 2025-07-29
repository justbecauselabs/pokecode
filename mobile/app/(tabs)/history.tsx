import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSessionStore } from '@/stores/sessionStore';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface HistoryItem {
  sessionId: string;
  sessionTitle: string;
  messageCount: number;
  lastMessage: string;
  timestamp: Date;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { sessions, messages, loadSessions } = useSessionStore();
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const historyItems = useMemo(() => {
    const items: HistoryItem[] = [];
    
    sessions.forEach(session => {
      const sessionMessages = messages[session.id] || [];
      if (sessionMessages.length > 0) {
        const lastMessage = sessionMessages[sessionMessages.length - 1];
        items.push({
          sessionId: session.id,
          sessionTitle: session.title || session.projectPath,
          messageCount: sessionMessages.length,
          lastMessage: lastMessage.content.substring(0, 100) + '...',
          timestamp: new Date(session.lastMessageAt || session.updatedAt),
        });
      }
    });
    
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [sessions, messages]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return historyItems;
    
    const query = searchQuery.toLowerCase();
    return historyItems.filter(item =>
      item.sessionTitle.toLowerCase().includes(query) ||
      item.lastMessage.toLowerCase().includes(query)
    );
  }, [historyItems, searchQuery]);

  const sections = useMemo(() => {
    const grouped = new Map<string, HistoryItem[]>();
    
    filteredItems.forEach(item => {
      const date = startOfDay(item.timestamp);
      let key: string;
      
      if (isToday(date)) {
        key = 'Today';
      } else if (isYesterday(date)) {
        key = 'Yesterday';
      } else {
        key = format(date, 'MMMM d, yyyy');
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });
    
    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [filteredItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <Card
      variant="elevated"
      style={styles.historyCard}
      onPress={() => router.push(`/chat/${item.sessionId}`)}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[styles.sessionTitle, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {item.sessionTitle}
        </Text>
        <Text style={[styles.timestamp, { color: theme.colors.textTertiary }]}>
          {format(item.timestamp, 'h:mm a')}
        </Text>
      </View>
      <Text
        style={[styles.lastMessage, { color: theme.colors.textSecondary }]}
        numberOfLines={2}
      >
        {item.lastMessage}
      </Text>
      <View style={styles.cardFooter}>
        <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.textTertiary} />
        <Text style={[styles.messageCount, { color: theme.colors.textTertiary }]}>
          {item.messageCount} messages
        </Text>
      </View>
    </Card>
  );

  if (sessions.length === 0) {
    return (
      <SafeAreaView>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No conversation history
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
            Start a new conversation to see it here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
              },
            ]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.sessionId}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                {section.title}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Text style={[styles.emptySearchText, { color: theme.colors.textSecondary }]}>
                No conversations found
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 40,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptySearch: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 16,
  },
});