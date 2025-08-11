# Claude Code Directory Analysis

## Overview

This document provides a comprehensive analysis of the Claude Code CLI's local data storage structure in `~/.claude`. This investigation was conducted to understand the current data storage patterns before migrating from database-based prompt storage to local file-based storage.

## Directory Structure

The `~/.claude` directory serves as the central configuration and data storage location for Claude Code CLI, totaling **422MB** with the following structure:

```
~/.claude/
├── __store.db                    # Main SQLite database (11MB)
├── .encryption_key              # 32-byte encryption key for sensitive data
├── .DS_Store                    # macOS metadata
├── CLAUDE.md                    # Global user instructions and rules
├── settings.json                # Main configuration file
├── leaderboard.json             # Twitter/leaderboard OAuth credentials
├── leaderboard_submitted.json   # Usage tracking and analytics data
├── count_tokens.js              # Token counting utility script
├── agents/                      # Agent storage (currently empty)
├── commands/                    # Workflow template commands (4 files)
├── docs/                        # Documentation storage
├── local/                       # Local npm dependencies and modules
├── projects/                    # Per-project conversation logs (JSONL format)
├── shell-snapshots/             # Shell environment state snapshots
├── statsig/                     # Feature flag evaluation cache
└── todos/                       # Task management and tracking files
```

## Key Components

### 1. Main Database (`__store.db`)

**Type**: SQLite 3.x database (11MB)
**Purpose**: Central storage for conversation metadata and recent interactions

**Schema Structure**:
- `base_messages` (2,147 records): Core message metadata with hierarchical relationships
- `assistant_messages` (978 records): AI responses with cost tracking and timing data
- `user_messages` (1,169 records): User inputs and tool execution results
- `conversation_summaries`: Session summary data
- `__drizzle_migrations`: Database schema versioning

**Data Patterns**:
- Tracks 12 unique conversation sessions
- Parent-child message relationships for conversation threading
- Cost per message tracking (USD, typically ~$0.02 per interaction)
- Duration and model usage statistics
- Working directory context preservation
- Recent sessions use "claude-3-7-sonnet-20250219" model

### 2. Project-Based Conversation Storage (`projects/`)

**Structure**: 26 project directories organized by absolute filesystem path
**Format**: 508 JSONL (JSON Lines) files for conversation persistence
**Naming Convention**: `-Users-billy-workspace-[project-name]`

**File Format**: One JSON object per line containing:
- Complete conversation threads
- Tool usage results and outputs
- Command execution logs
- Session metadata (timestamps, git branches, working directory)

**Most Active Projects**:
- `aardvark`: 107 conversation files
- `claude-linear`: 112 files  
- `tee-time-alerts`: 56 files
- `troon-backend`: 71 files

### 3. Configuration Management

#### `settings.json`
Main configuration file containing:
- Model selection preferences ("sonnet")
- Hook system configuration for tool usage tracking
- Pre/post execution command definitions
- User interface and feedback preferences

#### `CLAUDE.md`
Global user instructions file that:
- References external rule files and project conventions
- Provides consistent behavior across all projects
- Defines user-specific preferences and workflows

### 4. Task Management System (`todos/`)

**Files**: 1,059 JSON files tracking implementation tasks
**Naming Pattern**: `{session-id}-agent-{session-id}.json`
**Structure**: Array of task objects with:
- `content`: Task description
- `status`: completed, pending, in_progress
- `id`: Unique identifier

**Purpose**: Cross-session task tracking for complex development workflows

### 5. Shell Environment Preservation (`shell-snapshots/`)

**Files**: 72 snapshot files (average ~184KB each)
**Content**: Complete shell state capture including:
- Function definitions
- Aliases and environment variables
- Command history context
- Working directory state

**Purpose**: Reproducible command execution environment across sessions

### 6. Supporting Systems

#### Leaderboard Integration
- `leaderboard.json`: Twitter OAuth credentials for usage analytics
- `leaderboard_submitted.json`: Submission history with 30-day retention
- Anonymous usage statistics collection and reporting

#### Token Counting (`count_tokens.js`)
- Node.js utility for usage analysis
- Parses JSONL conversation files
- Integrates with external analytics APIs
- Provides cost and usage insights

#### Feature Flags (`statsig/`)
- 13 evaluation cache files for feature flag system
- Session and stable ID tracking
- A/B testing and rollout management

### 7. Command System (`commands/`)

**Purpose**: Standardized workflow templates for common development tasks
**Files**: 4 Markdown command templates

#### Command Structure
```
/Users/billy/.claude/commands/
├── bug-fix.md           # Bug fixing workflow (31 lines)
├── debug.md             # Diagnostic command (4 lines)
├── plan-and-execute.md  # Comprehensive project workflow (59 lines)
└── task.md              # Todo implementation system (157 lines)
```

#### Command Types and Complexity

**1. debug.md** - Diagnostic Command
- **Complexity**: Simple (4 lines)
- **Purpose**: Deep problem diagnosis with systematic reasoning
- **Features**:
  - Parameter substitution using `$@` 
  - "Ultrathink" methodology requiring 5-10 potential causes
  - Research-focused diagnostic approach

**2. bug-fix.md** - Bug Fixing Workflow  
- **Complexity**: Medium (31 lines)
- **Purpose**: Streamlined bug fixing from issue to pull request
- **Phases**: Pre-work setup → Bug fixing → Post-completion
- **Features**:
  - GitHub issue and branch creation
  - Reproduce → test → fix → verify methodology
  - Commit, push, and PR workflow integration

**3. plan-and-execute.md** - Comprehensive Project Workflow
- **Complexity**: High (59 lines) 
- **Purpose**: Structured approach for complex task completion
- **Phases**: Research → Approaches → Evaluate → Implement → Validate → Output
- **Features**:
  - 6-phase workflow with strict ordering
  - Standardized 10-section output format
  - Trade-off analysis and decision matrix
  - Built-in validation and testing requirements

**4. task.md** - Todo Implementation System
- **Complexity**: Very High (157 lines)
- **Purpose**: Transform todos into implemented features with full lifecycle
- **Phases**: INIT → SETUP → REFINE → IMPLEMENT → COMMIT
- **Features**:
  - File system integration (`.claude/tasks/` directory)
  - User confirmation points throughout process
  - Task tracking and status management
  - Project description maintenance
  - Complete git workflow integration

#### Command System Patterns

**Common Characteristics**:
- **Markdown Format**: All commands use structured Markdown
- **Parameter Substitution**: Dynamic content via `$@` placeholders
- **Structured Workflows**: Clear phases and sequential steps
- **Git Integration**: Branch management, commits, PR workflows
- **Quality Gates**: Built-in validation and review checkpoints

**Integration Points**:
- **Git**: Branch creation, commits, pull requests
- **GitHub**: Issue tracking and collaboration
- **File System**: Task persistence in `.claude/tasks/`
- **Development Tools**: Build, test, and lint execution
- **Project Context**: Working directory and branch awareness

**Usage Patterns**:
- **Process Templates**: Reusable workflows for consistent execution
- **Knowledge Capture**: Embedded best practices and methodologies  
- **Quality Assurance**: Systematic validation and testing steps
- **Project Management**: Task lifecycle and status tracking

## Data Architecture Insights

### Storage Strategy
The system employs a hybrid storage approach:

1. **Hot Data**: Recent conversations in SQLite for fast access and querying
2. **Cold Data**: Historical conversations in JSONL files for long-term archival
3. **Context Data**: Shell snapshots for environment reproduction
4. **Metadata**: Configuration and tracking in structured JSON files

### Key Characteristics

1. **Project Isolation**: Each project maintains separate conversation contexts
2. **Comprehensive Tracking**: Every interaction recorded with cost, timing, and outcome data
3. **Environment Reproduction**: Shell snapshots enable consistent command execution
4. **Task Continuity**: Todo system maintains development workflow context across sessions
5. **Analytics Integration**: Both local token counting and external usage reporting
6. **Security**: Encryption key management for sensitive data protection

### Performance Considerations

- **Database Size**: 11MB SQLite database for 2,147 messages indicates efficient storage
- **File Distribution**: 508 conversation files distributed across 26 projects
- **Total Footprint**: 422MB total with majority in shell snapshots and conversation logs
- **Access Patterns**: Recent data in database, historical data in files

## Migration Implications

When migrating to local file-based prompt storage, consider:

1. **Existing Structure**: Leverage the proven JSONL format already used for conversations
2. **Project Organization**: Maintain per-project isolation patterns
3. **Metadata Preservation**: Ensure cost tracking, timing, and context data retention
4. **Search Capabilities**: Plan for efficient retrieval across distributed files
5. **Backup Strategy**: File-based system easier to backup than database
6. **Concurrent Access**: Handle multiple sessions accessing the same project data

## Recommendations

1. **Format Consistency**: Use JSONL format to match existing conversation storage
2. **Directory Structure**: Follow the established project-based organization
3. **Metadata Standards**: Preserve the rich metadata patterns from the database
4. **Indexing Strategy**: Consider lightweight indexing for cross-file search
5. **Migration Path**: Provide tools to export database content to file format
6. **Backward Compatibility**: Maintain ability to read existing conversation files

## Security and Privacy

- **Encryption**: 32-byte encryption key suggests sensitive data protection
- **Local Storage**: All data remains on local filesystem
- **Opt-in Analytics**: Usage reporting appears to be optional/configurable
- **Project Isolation**: Conversations are isolated by project context