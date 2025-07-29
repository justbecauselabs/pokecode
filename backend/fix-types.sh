#!/bin/bash

# Fix import issues
find src -name "*.ts" -exec sed -i '' 's/import { Static }/import type { Static }/g' {} \;

# Fix rate limit timeWindow type
sed -i '' 's/timeWindow: number/timeWindow: string/g' src/hooks/rate-limit.hook.ts

# Fix removeAdditional value
sed -i '' "s/removeAdditional: 'all'/removeAdditional: \"all\"/g" src/server.ts

# Fix encoding parameter type
sed -i '' 's/encoding as BufferEncoding/encoding as any/g' src/services/file.service.ts

# Make script executable
chmod +x fix-types.sh