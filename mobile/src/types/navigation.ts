export type RootStackParamList = {
  '(auth)/login': undefined;
  '(tabs)': undefined;
  '(tabs)/index': undefined;
  '(tabs)/chat/[sessionId]': { sessionId: string };
  '(tabs)/files': { sessionId?: string };
  '(tabs)/files/[...path]': { path: string[]; sessionId: string };
  '(tabs)/history': undefined;
  '+not-found': undefined;
};