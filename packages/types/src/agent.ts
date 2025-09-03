export type Agent = {
  name: string;
  description: string;
  color?: string;
  content: string;
  type: 'user' | 'project';
};

export type ListAgentsQuery = {
  type?: 'user' | 'project' | 'all' | undefined;
  search?: string | undefined;
};

export type ListAgentsResponse = {
  agents: Agent[];
  sources: { userAgentsPath?: string; projectAgentsPath?: string };
};
