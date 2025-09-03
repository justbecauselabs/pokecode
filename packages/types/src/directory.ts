export type DirectoryItem = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  isGitRepository?: boolean;
};
export type BrowseDirectoryQuery = {
  path?: string;
};

export type BrowseDirectoryResponse = {
  currentPath: string;
  parentPath: string | null;
  items: DirectoryItem[];
};

export type AddRepositoryRequest = { path: string };
export type AddRepositoryResponse = {
  success: boolean;
  repository?: { folderName: string; path: string; isGitRepository: boolean };
};
