/**
 * Gemini AI factory function
 * Creates a GoogleGenAI instance with built-in retry and timeout configuration.
 * Supports dual auth modes: AI Studio API Key + Vertex AI ADC.
 */

import { GoogleGenAI } from '@google/genai';
import { API_CONFIG } from '../config/constants.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Auth mode types
export type AuthMode = 'api-key' | 'vertex-ai';

export interface AuthConfig {
  mode: AuthMode;
  apiKey?: string;      // AI Studio mode
  project?: string;     // Vertex AI mode
  location?: string;    // Vertex AI mode
  credentials?: Record<string, any>;  // Vertex AI: inline service account JSON
}

// Shared HTTP options for both modes
const HTTP_OPTIONS = {
  timeout: API_CONFIG.timeout,
  retryOptions: {
    attempts: API_CONFIG.maxRetries + 1, // 4 attempts (initial + 3 retries)
  },
};

/**
 * Fix Windows env var corruption: MCP clients on Windows may convert
 * forward slashes (/) to backslashes (\) in environment variable values.
 * This corrupts PEM private key base64 content and URL fields.
 *
 * Safe to call unconditionally — PEM base64 and URLs never contain
 * legitimate backslashes, so this is a no-op on non-corrupted data.
 */
function fixWindowsSlashCorruption(credentials: Record<string, any>): Record<string, any> {
  const fixed = { ...credentials };

  // Fix private_key: base64 alphabet uses / but never \
  if (typeof fixed.private_key === 'string') {
    fixed.private_key = fixed.private_key.replace(/\\/g, '/');
  }

  // Fix URL fields that may contain corrupted slashes
  const urlFields = ['auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
  for (const key of urlFields) {
    if (typeof fixed[key] === 'string') {
      fixed[key] = fixed[key].replace(/\\/g, '/');
    }
  }

  return fixed;
}

/**
 * Write credentials to a temp file and set GOOGLE_APPLICATION_CREDENTIALS.
 * This is the most reliable way to pass service account credentials to the SDK,
 * avoiding env var encoding issues with PEM private keys on Windows.
 */
function setupCredentialsTempFile(credentials: Record<string, any>): void {
  const fixed = fixWindowsSlashCorruption(credentials);
  const tempFile = path.join(os.tmpdir(), 'gemini-mcp-sa-credentials.json');
  fs.writeFileSync(tempFile, JSON.stringify(fixed), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFile;
  console.error(`[INFO] Credentials written to temp file for SDK authentication`);
}

/**
 * Create a GoogleGenAI instance based on auth config.
 * Supports both AI Studio (API Key) and Vertex AI (ADC) modes.
 *
 * @param config - Authentication configuration
 * @returns Configured GoogleGenAI instance
 */
export function createGeminiAI(config: AuthConfig): GoogleGenAI {
  if (config.mode === 'vertex-ai') {
    // Write inline credentials to temp file so SDK can read via ADC
    if (config.credentials) {
      setupCredentialsTempFile(config.credentials);
    }

    // Remove conflicting API key env vars before SDK initialization.
    // Known @google/genai SDK bug (#616): if GEMINI_API_KEY or GOOGLE_API_KEY
    // exist in process.env alongside vertexai:true, the SDK takes the wrong
    // auth path and throws an unhandled promise rejection, crashing Node.js.
    // Safe to delete here — we're in Vertex AI mode and don't need these keys.
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    return new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      httpOptions: HTTP_OPTIONS,
    });
  }

  // Default: API Key mode
  return new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: HTTP_OPTIONS,
  });
}

/**
 * Try to reconstruct service account credentials from env vars.
 * When users paste the raw JSON key file content into MCP env field,
 * each JSON key becomes an env var (e.g., type, project_id, private_key).
 * This detects that pattern and assembles the credentials object.
 */
function detectRawServiceAccountEnv(): Record<string, any> | null {
  const type = process.env.type;
  const projectId = process.env.project_id;
  const privateKey = process.env.private_key;
  const clientEmail = process.env.client_email;

  if (type === 'service_account' && projectId && privateKey && clientEmail) {
    return {
      type,
      project_id: projectId,
      private_key_id: process.env.private_key_id,
      private_key: privateKey,
      client_email: clientEmail,
      client_id: process.env.client_id,
      auth_uri: process.env.auth_uri,
      token_uri: process.env.token_uri,
      auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
      client_x509_cert_url: process.env.client_x509_cert_url,
      universe_domain: process.env.universe_domain,
    };
  }

  return null;
}

/**
 * Detect auth mode from environment variables.
 * Supports 3 ways to configure Vertex AI (in priority order):
 *   1. GOOGLE_GENAI_USE_VERTEXAI=true + explicit env vars
 *   2. Raw service account JSON pasted into MCP env (auto-detected)
 *   3. GEMINI_API_KEY for AI Studio mode
 *
 * Returns AuthConfig or throws with a helpful error message.
 */
export function detectAuthConfig(): AuthConfig {
  const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const apiKey = process.env.GEMINI_API_KEY;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  // Both configured: prefer Vertex AI (more secure), warn user
  if (useVertexAI && apiKey) {
    console.error(
      '[WARN] Both GEMINI_API_KEY and GOOGLE_GENAI_USE_VERTEXAI are set. Using Vertex AI mode.'
    );
  }

  // Mode 1: Explicit Vertex AI configuration
  if (useVertexAI) {
    if (!project) {
      throw new Error(
        'Vertex AI mode requires GOOGLE_CLOUD_PROJECT. ' +
        'Set it to your GCP project ID (e.g., "my-project-123").'
      );
    }

    // Parse inline credentials JSON if provided
    let credentials: Record<string, any> | undefined;
    if (credentialsJson) {
      try {
        credentials = JSON.parse(credentialsJson);
        console.error('[INFO] Using inline service account credentials from GOOGLE_CREDENTIALS_JSON');
      } catch {
        throw new Error(
          'GOOGLE_CREDENTIALS_JSON contains invalid JSON. ' +
          'Paste the entire content of your service account JSON key file.'
        );
      }
    }

    return {
      mode: 'vertex-ai',
      project,
      location: location || 'global',
      credentials,
    };
  }

  // Mode 2: Raw service account JSON pasted directly into MCP env
  const rawCredentials = detectRawServiceAccountEnv();
  if (rawCredentials) {
    console.error('[INFO] Auto-detected service account credentials from env vars');
    console.error('[INFO] Vertex AI mode enabled (project: ' + rawCredentials.project_id + ')');
    return {
      mode: 'vertex-ai',
      project: rawCredentials.project_id,
      location: location || 'global',
      credentials: rawCredentials,
    };
  }

  // Mode 3: AI Studio API Key
  if (apiKey) {
    return {
      mode: 'api-key',
      apiKey,
    };
  }

  throw new Error(
    'No authentication configured. Set one of:\n' +
    '  - GEMINI_API_KEY for AI Studio mode\n' +
    '  - GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT for Vertex AI mode\n' +
    '  - Paste your service account JSON directly into the env field\n' +
    'See README.md for details.'
  );
}
