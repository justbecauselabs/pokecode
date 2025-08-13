# Debug Logging Example

## What you'll see in the console when requests fail

### Successful Request (Debug Mode):
```
[2025-08-13T05:30:15.123Z] API Request: GET http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.124Z] API Request Base URL: http://localhost:3001
[2025-08-13T05:30:15.125Z] API Request Headers: {
  "Content-Type": "application/json"
}
[2025-08-13T05:30:15.201Z] API Response: 200 OK
[2025-08-13T05:30:15.202Z] API Response Headers: {
  "content-type": "application/json",
  "content-length": "1234"
}
[2025-08-13T05:30:15.203Z] API Success Response data: {
  "sessions": [...]
}
```

### Network Error:
```
[2025-08-13T05:30:15.123Z] API Request: GET http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.124Z] API Request Base URL: http://localhost:3001
[2025-08-13T05:30:15.125Z] API Request Headers: {
  "Content-Type": "application/json"
}
[2025-08-13T05:30:20.500Z] API Network/Fetch Error: TypeError: Network request failed
[2025-08-13T05:30:20.501Z] API Failed URL: http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:20.502Z] API Request Config: {
  "method": "GET",
  "headers": { "Content-Type": "application/json" }
}
```

### API Error (404, 500, etc.):
```
[2025-08-13T05:30:15.123Z] API Request: GET http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.124Z] API Request Base URL: http://localhost:3001
[2025-08-13T05:30:15.125Z] API Request Headers: {
  "Content-Type": "application/json"
}
[2025-08-13T05:30:15.300Z] API Response: 404 Not Found
[2025-08-13T05:30:15.301Z] API Response Headers: {
  "content-type": "text/plain",
  "content-length": "23"
}
[2025-08-13T05:30:15.302Z] API Error Response Body: Endpoint not found
[2025-08-13T05:30:15.303Z] API Error Details: API Error: 404 Not Found - Endpoint not found
[2025-08-13T05:30:15.304Z] API Error Request URL: http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.305Z] API Error Request Method: GET
```

### JSON Parse Error:
```
[2025-08-13T05:30:15.123Z] API Request: GET http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.124Z] API Request Base URL: http://localhost:3001
[2025-08-13T05:30:15.125Z] API Request Headers: {
  "Content-Type": "application/json"
}
[2025-08-13T05:30:15.200Z] API Response: 200 OK
[2025-08-13T05:30:15.201Z] API Response Headers: {
  "content-type": "text/plain"
}
[2025-08-13T05:30:15.202Z] API JSON Parse Error: SyntaxError: Unexpected token 'H' at position 0
[2025-08-13T05:30:15.203Z] API Error: Response was not valid JSON
```

### POST Request with Body:
```
[2025-08-13T05:30:15.123Z] API Request: POST http://localhost:3001/api/claude-code/sessions/
[2025-08-13T05:30:15.124Z] API Request Base URL: http://localhost:3001
[2025-08-13T05:30:15.125Z] API Request Headers: {
  "Content-Type": "application/json"
}
[2025-08-13T05:30:15.126Z] API Request Body: {"projectPath":"/path/to/project","context":"User context"}
```

## Debug Mode Activation

Debug logging is automatically enabled when:
1. **Development mode** (`__DEV__ = true`)
2. **Custom API URL is set** in settings (for troubleshooting production issues)

This means you'll see detailed logs in development, and can enable them in production by setting a custom API URL in the settings screen.