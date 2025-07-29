declare module 'react-native-syntax-highlighter' {
  import { Component } from 'react';
  import { TextStyle, ViewStyle } from 'react-native';

  interface SyntaxHighlighterProps {
    language?: string;
    style?: any;
    children: string;
    customStyle?: ViewStyle;
    codeTagProps?: {
      style?: TextStyle;
    };
    fontSize?: number;
    highlighter?: string;
  }

  export default class SyntaxHighlighter extends Component<SyntaxHighlighterProps> {}
}

declare module 'react-syntax-highlighter/styles/hljs' {
  export const vs2015: any;
  export const github: any;
  export const monokai: any;
  export const tomorrow: any;
  export const tomorrowNight: any;
  export const solarizedLight: any;
  export const solarizedDark: any;
}