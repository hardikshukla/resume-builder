import { useState, useEffect } from 'react';

export function useApiKey() {
  const [anthropicKey, setAnthropicKey] = useState<string>('');
  const [dropboxToken, setDropboxToken] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAnthropicKey(sessionStorage.getItem('anthropic_key') || '');
      setDropboxToken(sessionStorage.getItem('dropbox_token') || '');
    }
  }, []);

  const updateAnthropicKey = (val: string) => {
    setAnthropicKey(val);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('anthropic_key', val);
    }
  };

  const updateDropboxToken = (val: string) => {
    setDropboxToken(val);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dropbox_token', val);
    }
  };

  return {
    anthropicKey,
    dropboxToken,
    setAnthropicKey: updateAnthropicKey,
    setDropboxToken: updateDropboxToken,
  };
}
