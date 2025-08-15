/**
 * Agent-related TypeScript types for the mobile app
 * These correspond to the backend agent schema
 */

export interface Agent {
  name: string;
  description: string;
  color?: string;
  content: string;
  type: 'user' | 'project';
}

export interface GetAgentsResponse {
  agents: Agent[];
  sources: {
    userAgentsPath?: string;
    projectAgentsPath?: string;
  };
}

export interface GetAgentsQuery {
  type?: 'user' | 'project' | 'all';
  search?: string;
}
