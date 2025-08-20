import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CustomBottomSheet } from '../common';

interface SlashCommand {
  name: string;
  body: string;
  type: 'user' | 'project';
}

interface SlashCommandBottomSheetProps {
  commands: SlashCommand[];
  isLoading?: boolean;
  error?: Error | null;
  onSelectCommand: (params: { commandName: string }) => void;
  onClose: () => void;
}

export const SlashCommandBottomSheet = forwardRef<BottomSheetModal, SlashCommandBottomSheetProps>(
  ({ commands, isLoading, error, onSelectCommand, onClose }, ref) => {
    const handleCommandSelect = (commandName: string) => {
      onSelectCommand({ commandName });
      onClose();
    };

    // Group commands by type for better organization
    const groupedCommands = useMemo(() => {
      const userCommands = commands.filter((cmd) => cmd.type === 'user');
      const projectCommands = commands.filter((cmd) => cmd.type === 'project');
      return { userCommands, projectCommands };
    }, [commands]);

    const renderCommandItem = (command: SlashCommand) => (
      <TouchableOpacity
        key={command.name}
        className="flex-row items-center justify-between py-3 px-4 border-b border-border active:opacity-70"
        onPress={() => handleCommandSelect(command.name)}
        activeOpacity={0.7}
      >
        <View className="flex-1">
          <Text className="text-base font-mono text-foreground">/{command.name}</Text>
          <Text className="text-sm text-muted-foreground mt-1 font-mono" numberOfLines={2}>
            {command.body.split('\n')[0] || 'No description available'}
          </Text>
        </View>
        <View
          className={`px-2 py-1 rounded-md ${
            command.type === 'user' ? 'bg-blue-500/20' : 'bg-green-500/20'
          }`}
        >
          <Text
            className={`text-xs font-mono ${
              command.type === 'user' ? 'text-blue-400' : 'text-green-400'
            }`}
          >
            {command.type}
          </Text>
        </View>
      </TouchableOpacity>
    );

    const renderContent = () => {
      if (isLoading) {
        return (
          <View className="justify-center items-center py-8">
            <Text className="text-center text-muted-foreground font-mono">Loading commands...</Text>
          </View>
        );
      }

      if (error) {
        return (
          <View className="justify-center items-center py-8">
            <Text className="text-center text-destructive font-mono">Failed to load commands</Text>
            <Text className="text-center text-muted-foreground font-mono text-sm mt-2">
              {error.message}
            </Text>
          </View>
        );
      }

      if (commands.length === 0) {
        return (
          <View className="justify-center items-center py-8">
            <Text className="text-center text-muted-foreground font-mono">
              No slash commands found
            </Text>
            <Text className="text-center text-muted-foreground font-mono text-sm mt-2">
              Add .md files to ~/.claude/commands/ or project/commands/
            </Text>
          </View>
        );
      }

      return (
        <View>
          {/* Project Commands Section */}
          {groupedCommands.projectCommands.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-green-400 mb-2 px-4 font-mono">
                PROJECT COMMANDS ({groupedCommands.projectCommands.length})
              </Text>
              {groupedCommands.projectCommands.map(renderCommandItem)}
            </View>
          )}

          {/* User Commands Section */}
          {groupedCommands.userCommands.length > 0 && (
            <View>
              <Text className="text-sm font-semibold text-blue-400 mb-2 px-4 font-mono">
                USER COMMANDS ({groupedCommands.userCommands.length})
              </Text>
              {groupedCommands.userCommands.map(renderCommandItem)}
            </View>
          )}
        </View>
      );
    };

    return (
      <CustomBottomSheet ref={ref} onClose={onClose}>
        <View className="flex-1 px-4">
          {/* Header */}
          <View className="py-3 border-b border-border mb-3">
            <Text className="text-lg font-semibold text-center text-foreground font-mono">
              Slash Commands
            </Text>
            <Text className="text-sm text-center text-muted-foreground mt-1 font-mono">
              Select a command to insert
            </Text>
          </View>

          {/* Commands list */}
          <BottomSheetScrollView
            contentContainerClassName="pb-5"
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </BottomSheetScrollView>
        </View>
      </CustomBottomSheet>
    );
  }
);

SlashCommandBottomSheet.displayName = 'SlashCommandBottomSheet';
