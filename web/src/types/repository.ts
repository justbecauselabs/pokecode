export interface Repository {
  folderName: string
  path: string
  isGitRepository: boolean
}

export interface ListRepositoriesResponse {
  repositories: Repository[]
  total: number
  githubReposDirectory: string
}