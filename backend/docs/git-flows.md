# Git Flow Documentation

This guide covers version control best practices and Git workflows for the Claude Code Mobile backend project.

## Branch Strategy

### Main Branches

- **`main`**: Production-ready code. Protected branch with required reviews.
- **`develop`**: Integration branch for features. Pre-production state.

### Supporting Branches

- **`feature/*`**: New features and enhancements
- **`bugfix/*`**: Bug fixes for development branch
- **`hotfix/*`**: Critical fixes for production
- **`release/*`**: Release preparation
- **`chore/*`**: Maintenance tasks (deps, configs, etc.)

## Branch Naming Conventions

```
feature/add-user-authentication
feature/session-export-api
bugfix/fix-rate-limiting-redis
hotfix/critical-auth-bypass
release/v1.2.0
chore/update-dependencies
```

Use kebab-case and be descriptive but concise.

## Development Workflow

### 1. Starting a New Feature

```bash
# Update develop branch
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/your-feature-name

# Work on your feature
# ... make changes ...

# Stage and commit changes
git add .
git commit -m "feat: add session tagging system"
```

### 2. Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or modifying tests
- **chore**: Maintenance tasks
- **ci**: CI/CD changes

#### Examples

```bash
# Feature
git commit -m "feat(auth): implement JWT refresh token rotation"

# Bug fix
git commit -m "fix(sessions): resolve memory leak in SSE connections"

# With scope and breaking change
git commit -m "feat(api)!: change session response format

BREAKING CHANGE: Session API now returns nested user object instead of userId"

# With issue reference
git commit -m "fix(db): handle connection timeout gracefully

Closes #123"
```

### 3. Pushing Changes

```bash
# Push feature branch
git push origin feature/your-feature-name

# First push (set upstream)
git push -u origin feature/your-feature-name
```

### 4. Creating Pull Requests

When creating a PR:

1. **Title**: Use conventional commit format
2. **Description**: Include:
   - What changes were made
   - Why they were necessary
   - How to test
   - Screenshots (if UI changes)
   - Breaking changes

#### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- List key changes
- Include technical details

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No console.logs left

## Screenshots (if applicable)

## Related Issues
Closes #XXX
```

### 5. Code Review Process

#### For Reviewers

- Check code quality and style
- Verify tests are included
- Ensure documentation is updated
- Look for security issues
- Test the changes locally
- Provide constructive feedback

#### For Authors

- Respond to all comments
- Make requested changes
- Re-request review after updates
- Keep PR up to date with base branch

### 6. Merging

```bash
# Update feature branch with latest develop
git checkout develop
git pull origin develop
git checkout feature/your-feature-name
git merge develop

# Resolve conflicts if any
# Test everything works

# Push updates
git push origin feature/your-feature-name
```

After PR approval:
- Squash and merge for features
- Create merge commit for releases
- Delete feature branch after merge

## Release Workflow

### 1. Create Release Branch

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
```

### 2. Prepare Release

```bash
# Update version in package.json
npm version minor  # or major/patch

# Update CHANGELOG.md
# Run final tests
pnpm test
pnpm build

# Commit changes
git add .
git commit -m "chore(release): prepare v1.2.0"
```

### 3. Finish Release

```bash
# Merge to main
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"

# Merge back to develop
git checkout develop
git merge --no-ff release/v1.2.0

# Push everything
git push origin main develop --tags

# Delete release branch
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

## Hotfix Workflow

For critical production issues:

```bash
# Create from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Fix the issue
# ... make changes ...

# Commit
git commit -m "fix: resolve critical authentication bypass"

# Merge to main
git checkout main
git merge --no-ff hotfix/critical-bug
git tag -a v1.2.1 -m "Hotfix version 1.2.1"

# Merge to develop
git checkout develop
git merge --no-ff hotfix/critical-bug

# Push and cleanup
git push origin main develop --tags
git branch -d hotfix/critical-bug
```

## Working with Git

### Useful Commands

```bash
# View branch graph
git log --oneline --graph --decorate --all

# Interactive rebase (clean up commits)
git rebase -i HEAD~3

# Stash changes
git stash save "WIP: feature description"
git stash list
git stash pop

# Cherry-pick specific commit
git cherry-pick <commit-hash>

# Reset to previous commit (careful!)
git reset --soft HEAD~1  # Keep changes staged
git reset --hard HEAD~1  # Discard changes

# Find commits by message
git log --grep="auth"

# Show changes in commit
git show <commit-hash>

# Blame (who changed what)
git blame src/routes/auth/index.ts
```

### Resolving Conflicts

```bash
# When merge conflicts occur
git status  # See conflicted files

# Edit conflicted files, look for:
# <<<<<<< HEAD
# Your changes
# =======
# Their changes
# >>>>>>> branch-name

# After resolving
git add <resolved-files>
git commit

# Or abort merge
git merge --abort
```

### Cleaning Up

```bash
# Delete local branch
git branch -d feature/old-feature

# Delete remote branch
git push origin --delete feature/old-feature

# Prune deleted remote branches
git fetch --prune

# Clean untracked files
git clean -fd  # Use with caution!
```

## Best Practices

### 1. Commit Practices

- **Small, focused commits**: Each commit should represent one logical change
- **Commit often**: Don't wait until feature is complete
- **Write meaningful messages**: Future you will thank you
- **No commented code**: Use git history instead
- **No console.logs**: Remove debug statements

### 2. Branch Practices

- **Keep branches short-lived**: Merge within a few days
- **Update frequently**: Pull from develop regularly
- **One feature per branch**: Don't mix unrelated changes
- **Delete after merge**: Keep repository clean

### 3. Before Pushing

Always run before pushing:

```bash
# Format and lint
pnpm format
pnpm lint:fix

# Run tests
pnpm test

# Type check
pnpm type-check

# Build check
pnpm build
```

### 4. Security Practices

- **Never commit secrets**: Use environment variables
- **Review diff before commit**: `git diff --staged`
- **Use .gitignore**: Keep sensitive files out
- **Scan for secrets**: Use tools like git-secrets

### 5. Collaboration

- **Communicate**: Use PR descriptions and comments
- **Be responsive**: Address review comments promptly
- **Help others**: Review teammates' PRs
- **Ask questions**: When unsure, ask for clarification

## Git Hooks

### Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting
pnpm lint:fix

# Run type checking
pnpm type-check

# Run tests for changed files
pnpm test:related
```

### Commit Message Hook

Create `.husky/commit-msg`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate commit message format
npx commitlint --edit $1
```

## Troubleshooting

### Common Issues

#### Accidentally committed to wrong branch

```bash
# If not pushed yet
git reset HEAD~1
git stash
git checkout correct-branch
git stash pop
git add .
git commit -m "your message"
```

#### Need to amend last commit

```bash
# Add more changes to last commit
git add .
git commit --amend

# Change last commit message
git commit --amend -m "new message"
```

#### Revert a pushed commit

```bash
# Create a new commit that undoes changes
git revert <commit-hash>

# For merge commits
git revert -m 1 <merge-commit-hash>
```

#### Lost commits after reset

```bash
# Find lost commits
git reflog

# Restore lost commit
git checkout <commit-hash>
```

## CI/CD Integration

### GitHub Actions

Ensure your commits trigger appropriate CI workflows:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test:coverage
      - run: pnpm build
```

### Protected Branch Rules

Configure for `main` and `develop`:

- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- Require conversation resolution
- Include administrators