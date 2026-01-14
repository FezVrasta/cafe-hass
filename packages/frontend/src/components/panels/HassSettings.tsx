import { AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Home Assistant Connection</DialogTitle>
          <DialogDescription>Configure your Home Assistant connection settings.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Home Assistant URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://homeassistant.local:8123"
            />
            <p className="text-muted-foreground text-xs">The URL of your Home Assistant instance</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Long-Lived Access Token</Label>
            <Input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJ0eXAiOiJKV1QiLCJhbGci..."
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Create one in HA: Profile → Long-Lived Access Tokens
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={testConnection} disabled={status === 'testing'}>
              {status === 'testing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {status === 'success' && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                Connected!
              </span>
            )}

            {status === 'error' && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </span>
            )}
          </div>

          <Alert>
            <AlertDescription>
              <h4 className="mb-1 font-medium">CORS Note</h4>
              <p className="mb-2 text-xs">
                To connect from a browser, you may need to add CORS headers to your HA config. If
                you are connecting from https://fezvrasta.github.io/hass-cafe, you need your HA
                instance to be under HTTPS.
              </p>
              <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                {`http:
  cors_allowed_origins:
    - https://my-home-assistant.example.com`}
              </pre>
            </AlertDescription>
          </Alert>

          <Button variant="link" asChild className="h-auto p-0 text-sm">
            <a
              href="https://www.home-assistant.io/docs/authentication/#your-account-profile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              How to create a Long-Lived Access Token
            </a>
          </Button>
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="destructive" onClick={handleClear} size="sm">
            Disconnect
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!url || !token} size="sm">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
