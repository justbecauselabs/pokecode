export type Command = {
  name: string;
  body: string;
  type: 'user' | 'project';
};

export type ListCommandsQuery = {
  type?: 'user' | 'project' | 'all' | undefined;
  search?: string | undefined;
};

export type ListCommandsResponse = {
  commands: Command[];
  sources: { userCommandsPath?: string; projectCommandsPath?: string };
};
