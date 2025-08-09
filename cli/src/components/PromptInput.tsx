/**
 * Input component for chat prompts
 */

import React, { useState, useCallback, useReducer } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';

interface PromptInputProps {
  onSubmit: (message: string) => void;
  isDisabled?: boolean;
  placeholder?: string;
}

interface InputState {
  text: string;
  cursorPosition: number;
}

type InputAction = 
  | { type: 'SET_TEXT'; text: string; cursorPosition?: number }
  | { type: 'ADD_CHAR'; char: string; position: number }
  | { type: 'DELETE_CHAR'; position: number }
  | { type: 'MOVE_CURSOR'; position: number }
  | { type: 'CLEAR' };

function inputReducer(state: InputState, action: InputAction): InputState {
  switch (action.type) {
    case 'SET_TEXT':
      return {
        text: action.text,
        cursorPosition: action.cursorPosition ?? action.text.length
      };
    case 'ADD_CHAR':
      const newText = 
        state.text.slice(0, action.position) + 
        action.char + 
        state.text.slice(action.position);
      return {
        text: newText,
        cursorPosition: action.position + 1
      };
    case 'DELETE_CHAR':
      if (action.position === 0) return state;
      return {
        text: state.text.slice(0, action.position - 1) + state.text.slice(action.position),
        cursorPosition: action.position - 1
      };
    case 'MOVE_CURSOR':
      return {
        ...state,
        cursorPosition: Math.max(0, Math.min(state.text.length, action.position))
      };
    case 'CLEAR':
      return { text: '', cursorPosition: 0 };
    default:
      return state;
  }
}

export const PromptInput: React.FC<PromptInputProps> = ({ 
  onSubmit, 
  isDisabled = false,
  placeholder = 'Type your message...'
}) => {
  const [inputState, dispatch] = useReducer(inputReducer, { text: '', cursorPosition: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { exit } = useApp();

  useInput((char, key) => {
    if (isDisabled) return;

    // Handle special keys
    if (key.ctrl && char === 'd') {
      exit();
      return;
    }

    if (key.ctrl && char === 'c') {
      // Cancel current input
      dispatch({ type: 'CLEAR' });
      return;
    }

    if (key.ctrl && char === 'l') {
      // Clear screen (handled by parent)
      return;
    }

    // Submit on Enter
    if (key.return && !key.shift) {
      if (inputState.text.trim()) {
        handleSubmit();
      }
      return;
    }

    // History navigation
    if (key.upArrow) {
      navigateHistory('up');
      return;
    }

    if (key.downArrow) {
      navigateHistory('down');
      return;
    }

    // Cursor movement
    if (key.leftArrow) {
      dispatch({ type: 'MOVE_CURSOR', position: inputState.cursorPosition - 1 });
      return;
    }

    if (key.rightArrow) {
      dispatch({ type: 'MOVE_CURSOR', position: inputState.cursorPosition + 1 });
      return;
    }

    // Home/End keys
    if (key.home || (key.ctrl && char === 'a')) {
      dispatch({ type: 'MOVE_CURSOR', position: 0 });
      return;
    }

    if (key.end || (key.ctrl && char === 'e')) {
      dispatch({ type: 'MOVE_CURSOR', position: inputState.text.length });
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      dispatch({ type: 'DELETE_CHAR', position: inputState.cursorPosition });
      return;
    }

    // Regular character input
    if (!key.ctrl && !key.meta && char && char.length === 1) {
      dispatch({ type: 'ADD_CHAR', char, position: inputState.cursorPosition });
    }
  });

  const handleSubmit = useCallback(() => {
    const trimmedInput = inputState.text.trim();
    if (trimmedInput) {
      // Add to history
      setHistory(prev => [...prev, trimmedInput]);
      setHistoryIndex(-1);
      
      // Submit
      onSubmit(trimmedInput);
      
      // Clear input
      dispatch({ type: 'CLEAR' });
    }
  }, [inputState.text, onSubmit]);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (history.length === 0) return;

    let newIndex = historyIndex;
    
    if (direction === 'up') {
      newIndex = historyIndex === -1 
        ? history.length - 1 
        : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === -1 
        ? -1 
        : Math.min(history.length - 1, historyIndex + 1);
    }

    setHistoryIndex(newIndex);
    
    if (newIndex === -1) {
      dispatch({ type: 'CLEAR' });
    } else {
      const historicalInput = history[newIndex] || '';
      dispatch({ type: 'SET_TEXT', text: historicalInput });
    }
  }, [history, historyIndex]);

  // Render input with cursor
  const renderInput = () => {
    if (inputState.text.length === 0) {
      return (
        <>
          <Text dimColor>{placeholder}</Text>
          <Text color="cyan">▊</Text>
        </>
      );
    }

    const beforeCursor = inputState.text.slice(0, inputState.cursorPosition);
    const atCursor = inputState.text[inputState.cursorPosition] || ' ';
    const afterCursor = inputState.text.slice(inputState.cursorPosition + 1);

    return (
      <>
        <Text>{beforeCursor}</Text>
        <Text backgroundColor="cyan" color="black">{atCursor}</Text>
        <Text>{afterCursor}</Text>
      </>
    );
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor={isDisabled ? 'gray' : 'cyan'}
      paddingX={1}
    >
      <Text color={isDisabled ? 'gray' : 'white'}>
        {isDisabled ? (
          <Text dimColor>Processing...</Text>
        ) : (
          renderInput()
        )}
      </Text>
    </Box>
  );
};