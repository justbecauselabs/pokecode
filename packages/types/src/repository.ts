export type RepositoryResponse = {
  folderName: string;
  path: string;
  isGitRepository: boolean;
};
export type ListRepositoriesResponse = {
  repositories: RepositoryResponse[];
  total: number;
  githubReposDirectory: string;
};
