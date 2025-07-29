import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from '@/components/shared/SafeAreaView';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { Input } from '@/components/ui/Input';
import { useSessionStore } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from '@/constants/theme';
import { Session } from '@/types/api';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

export default function ProjectsScreen() {
  const router = useRouter();
  const { sessions, isLoading, loadSessions, createSession, deleteSession } = useSessionStore();
  const { user, logout } = useAuthStore();
  const isDark = useUIStore((state) => state.isDark());
  const theme = isDark ? darkTheme : lightTheme;
  
  const [refreshing, setRefreshing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleCreateProject = async () => {
    if (!projectPath.trim()) {
      Alert.alert('Error', 'Please enter a project path');
      return;
    }

    try {
      const session = await createSession(projectPath.trim(), projectTitle.trim() || undefined);
      setShowNewProject(false);
      setProjectPath('');
      setProjectTitle('');
      router.push(`/chat/${session.id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create project');
    }
  };

  const handleDeleteProject = (session: Session) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${session.title || session.projectPath}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(session.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete project');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const renderSession = ({ item }: { item: Session }) => (
    <Card
      variant="elevated"
      style={styles.sessionCard}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View style={styles.sessionContent}>
        <View style={styles.sessionInfo}>
          <Text
            style={[styles.sessionTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {item.title || item.projectPath}
          </Text>
          <Text
            style={[styles.sessionPath, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.projectPath}
          </Text>
          <View style={styles.sessionMeta}>
            <Text style={[styles.sessionDate, { color: theme.colors.textTertiary }]}>
              {format(new Date(item.updatedAt), 'MMM d, yyyy')}
            </Text>
            {item.messageCount > 0 && (
              <Text style={[styles.messageCount, { color: theme.colors.textTertiary }]}>
                • {item.messageCount} messages
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteProject(item)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (isLoading && sessions.length === 0) {
    return <LoadingState text="Loading projects..." fullScreen />;
  }

  return (
    <SafeAreaView>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
              Welcome back,
            </Text>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {user?.name || user?.email}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {showNewProject ? (
          <Card variant="elevated" style={styles.newProjectCard}>
            <Text style={[styles.newProjectTitle, { color: theme.colors.text }]}>
              New Project
            </Text>
            <Input
              label="Project Path"
              placeholder="/path/to/your/project"
              value={projectPath}
              onChangeText={setProjectPath}
              autoCapitalize="none"
            />
            <Input
              label="Title (optional)"
              placeholder="My Awesome Project"
              value={projectTitle}
              onChangeText={setProjectTitle}
            />
            <View style={styles.newProjectActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setShowNewProject(false);
                  setProjectPath('');
                  setProjectTitle('');
                }}
              />
              <Button
                title="Create"
                onPress={handleCreateProject}
                loading={isLoading}
              />
            </View>
          </Card>
        ) : (
          <Button
            title="New Project"
            icon={<Ionicons name="add" size={20} color="#FFFFFF" />}
            onPress={() => setShowNewProject(true)}
            style={styles.newProjectButton}
          />
        )}

        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No projects yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                Create your first project to get started
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 8,
  },
  newProjectButton: {
    marginBottom: 16,
  },
  newProjectCard: {
    marginBottom: 16,
    padding: 20,
  },
  newProjectTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  newProjectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  sessionCard: {
    marginBottom: 12,
  },
  sessionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionPath: {
    fontSize: 14,
    marginBottom: 8,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: 12,
  },
  messageCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});