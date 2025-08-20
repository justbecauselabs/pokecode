import { Feather } from '@expo/vector-icons';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Agent } from '../../types/agents';
import { CustomBottomSheet } from '../common';

interface AgentSelectionBottomSheetProps {
  agents: Agent[];
  selectedAgents: string[];
  isLoading?: boolean;
  error?: Error | null;
  onToggleAgent: (params: { agentName: string }) => void;
  onClose: () => void;
}

export const AgentSelectionBottomSheet = forwardRef<
  BottomSheetModal,
  AgentSelectionBottomSheetProps
>(({ agents, selectedAgents, isLoading, error, onToggleAgent, onClose }, ref) => {
  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handleAgentToggle = (agentName: string) => {
    onToggleAgent({ agentName });
  };

  // Group agents by type for better organization
  const groupedAgents = useMemo(() => {
    const userAgents = agents.filter((agent) => agent.type === 'user');
    const projectAgents = agents.filter((agent) => agent.type === 'project');
    return { userAgents, projectAgents };
  }, [agents]);

  const renderAgentItem = (agent: Agent) => {
    const isSelected = selectedAgents.includes(agent.name);

    return (
      <TouchableOpacity
        key={agent.name}
        className="flex-row items-center py-3 px-4 border-b border-border active:opacity-70"
        onPress={() => handleAgentToggle(agent.name)}
        activeOpacity={0.7}
      >
        <View className="flex-1 mr-3">
          <Text className="text-base font-mono text-foreground">{agent.name}</Text>
          <Text className="text-sm text-muted-foreground mt-1 font-mono" numberOfLines={2}>
            {agent.description || 'No description available'}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <View
            className={`px-2 py-1 rounded-md ${
              agent.type === 'user' ? 'bg-blue-500/20' : 'bg-green-500/20'
            }`}
          >
            <Text
              className={`text-xs font-mono ${
                agent.type === 'user' ? 'text-blue-400' : 'text-green-400'
              }`}
            >
              {agent.type}
            </Text>
          </View>

          {/* Checkmark */}
          <View
            className={`w-6 h-6 rounded border-2 items-center justify-center ${
              isSelected ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30'
            }`}
          >
            {isSelected && <Feather name="check" size={14} color="white" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View className="justify-center items-center py-8">
          <Text className="text-center text-muted-foreground font-mono">Loading agents...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="justify-center items-center py-8">
          <Text className="text-center text-destructive font-mono">Failed to load agents</Text>
          <Text className="text-center text-muted-foreground font-mono text-sm mt-2">
            {error.message}
          </Text>
        </View>
      );
    }

    if (agents.length === 0) {
      return (
        <View className="justify-center items-center py-8">
          <Text className="text-center text-muted-foreground font-mono">No agents found</Text>
          <Text className="text-center text-muted-foreground font-mono text-sm mt-2">
            Add .md files to ~/.claude/agents/ or project/.claude/agents/
          </Text>
        </View>
      );
    }

    return (
      <View>
        {/* Project Agents Section */}
        {groupedAgents.projectAgents.length > 0 && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-green-400 mb-2 px-4 font-mono">
              PROJECT AGENTS ({groupedAgents.projectAgents.length})
            </Text>
            {groupedAgents.projectAgents.map(renderAgentItem)}
          </View>
        )}

        {/* User Agents Section */}
        {groupedAgents.userAgents.length > 0 && (
          <View>
            <Text className="text-sm font-semibold text-blue-400 mb-2 px-4 font-mono">
              USER AGENTS ({groupedAgents.userAgents.length})
            </Text>
            {groupedAgents.userAgents.map(renderAgentItem)}
          </View>
        )}
      </View>
    );
  };

  return (
    <CustomBottomSheet ref={ref} onClose={onClose} snapPoints={snapPoints}>
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="py-3 border-b border-border mb-3">
          <Text className="text-lg font-semibold text-center text-foreground font-mono">
            Agents
          </Text>
          <Text className="text-sm text-center text-muted-foreground mt-1 font-mono">
            Select agents to assist with your message ({selectedAgents.length} selected)
          </Text>
        </View>

        {/* Agents list */}
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </BottomSheetScrollView>
      </View>
    </CustomBottomSheet>
  );
});
