
type AuthEventType = 'SESSION_EXPIRED';

class AuthEvent extends Event {
  constructor(type: AuthEventType) {
    super(type);
  }
}

const authEventTarget = new EventTarget();

export const notifySessionExpired = () => {
  authEventTarget.dispatchEvent(new AuthEvent('SESSION_EXPIRED'));
};

export const onSessionExpired = (callback: () => void) => {
  const handler = () => callback();
  authEventTarget.addEventListener('SESSION_EXPIRED', handler);
  return () => authEventTarget.removeEventListener('SESSION_EXPIRED', handler);
};
