import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageInput } from '../MessageInput';

const mockOnSendMessage = jest.fn();

describe('MessageInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
      />
    );

    expect(getByPlaceholderText('Enter your message...')).toBeTruthy();
    expect(getByText('Send')).toBeTruthy();
  });

  it('disables send button when message is empty', () => {
    const { getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
      />
    );

    const sendButton = getByText('Send');
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables send button when message has content', () => {
    const { getByPlaceholderText, getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = getByPlaceholderText('Enter your message...');
    const sendButton = getByText('Send');

    fireEvent.changeText(input, 'Hello world');
    expect(sendButton.props.accessibilityState?.disabled).toBe(false);
  });

  it('calls onSendMessage when send button is pressed', async () => {
    mockOnSendMessage.mockResolvedValue({});

    const { getByPlaceholderText, getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = getByPlaceholderText('Enter your message...');
    const sendButton = getByText('Send');

    fireEvent.changeText(input, 'Hello world');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith({ content: 'Hello world' });
    });
  });

  it('clears input after successful send', async () => {
    mockOnSendMessage.mockResolvedValue({});

    const { getByPlaceholderText, getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
      />
    );

    const input = getByPlaceholderText('Enter your message...');
    const sendButton = getByText('Send');

    fireEvent.changeText(input, 'Hello world');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(input.props.value).toBe('');
    });
  });

  it('shows loading state when sending', () => {
    const { getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
        isSending={true}
      />
    );

    const sendButton = getByText('Send');
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('handles disabled state correctly', () => {
    const { getByText } = render(
      <MessageInput
        sessionId="test-session"
        onSendMessage={mockOnSendMessage}
        disabled={true}
      />
    );

    const sendButton = getByText('Send');
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });
});