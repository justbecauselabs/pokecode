import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <View className="flex-1 bg-background">
          <ScrollView contentContainerClassName="flex-grow justify-center items-center p-5">
            <Text className="text-2xl font-bold text-foreground mb-2.5 text-center">
              Oops! Something went wrong
            </Text>
            <Text className="text-base text-muted-foreground mb-7.5 text-center">
              We're sorry for the inconvenience. Please try again.
            </Text>

            {__DEV__ && this.state.error && (
              <View className="w-full bg-card p-4 rounded-lg mb-5">
                <Text className="text-base font-semibold text-destructive mb-2">Error Details:</Text>
                <Text className="text-sm text-foreground font-mono">
                  {this.state.error.toString()}
                </Text>

                {this.state.errorInfo && (
                  <View className="mt-4">
                    <Text className="text-sm font-semibold text-muted-foreground mb-2">
                      Component Stack:
                    </Text>
                    <ScrollView horizontal>
                      <Text className="text-xs text-muted-foreground font-mono">
                        {this.state.errorInfo.componentStack}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity 
              className="bg-primary px-6 py-3 rounded-lg" 
              onPress={this.handleReset}
            >
              <Text className="text-primary-foreground text-base font-semibold">
                Try Again
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

// Component now uses pure TailwindCSS classes - no StyleSheet needed!
