import { useState, useEffect } from 'react';
import { X, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HassConfig {
  url: string;
  token: string;
}

interface HassSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: HassConfig;
  onSave: (config: HassConfig) => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export function HassSettings({ isOpen, onClose, config, onSave }: HassSettingsProps) {
  const [url, setUrl] = useState(config.url);
  const [token, setToken] = useState(config.token);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(config.url);
      setToken(config.token);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, config]);

  const testConnection = async () => {
    if (!url || !token) {
      setStatus('error');
      setErrorMessage('Please provide both URL and token');
      return;
    }

    setStatus('testing');
    setErrorMessage('');

    try {
      const apiUrl = url.replace(/\/$/, '');
      const response = await fetch(`${apiUrl}/api/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message === 'API running.') {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage('Unexpected API response');
        }
      } else if (response.status === 401) {
        setStatus('error');
        setErrorMessage('Invalid token - authentication failed');
      } else {
        setStatus('error');
        setErrorMessage(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setStatus('error');
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setErrorMessage('Cannot connect - check URL and CORS settings');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Connection failed');
      }
    }
  };

  const handleSave = () => {
    onSave({ url: url.replace(/\/$/, ''), token });
    onClose();
  };

  const handleClear = () => {
    setUrl('');
    setToken('');
    onSave({ url: '', token: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-800">Home Assistant Connection</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Home Assistant URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              The URL of your Home Assistant instance
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Long-Lived Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Create one in HA: Profile → Long-Lived Access Tokens
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={testConnection}
              disabled={status === 'testing'}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                'bg-slate-100 hover:bg-slate-200 text-slate-700',
                status === 'testing' && 'opacity-50 cursor-not-allowed'
              )}
            >
              {status === 'testing' ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing...
                </span>
              ) : (
                'Test Connection'
              )}
            </button>

            {status === 'success' && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Connected!
              </span>
            )}

            {status === 'error' && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </span>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <h4 className="text-sm font-medium text-amber-800 mb-1">CORS Note</h4>
            <p className="text-xs text-amber-700">
              To connect from a browser, you may need to add CORS headers to your HA config:
            </p>
            <pre className="mt-2 text-xs bg-amber-100 p-2 rounded font-mono overflow-x-auto">
{`http:
  cors_allowed_origins:
    - http://localhost:5173`}
            </pre>
          </div>

          <a
            href="https://www.home-assistant.io/docs/authentication/#your-account-profile"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            How to create a Long-Lived Access Token
          </a>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            Clear & Use Mock Data
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!url || !token}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                url && token
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
