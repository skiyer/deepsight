import { useEffect } from 'react';

type MessageHandler = (message: any) => void;

export function useVSCodeMessage(handler: MessageHandler) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      handler(event.data);
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}
