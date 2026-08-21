declare global {
  interface Window {
    Loco?: {
      apply(language: string): Promise<unknown>;
      restore(): void;
      languages(): Promise<Array<{ code: string; name: string }>>;
    };
    __esheetLocoMode?: 'offline' | 'online';
  }
}

const FORMIE_KEY = 'agnt_key-mq5nn2ov8299ccaecdbcdde4';
const FLOWIE_KEY = 'agnt_key-mq5nm09n3c1945f5835bf1d2';

/**
 * Call on view mount to switch the active agent.
 * Pass FORMIE_KEY for the builder view, FLOWIE_KEY for the renderer view.
 */
export { FORMIE_KEY, FLOWIE_KEY };

export function updateOzwellTools(_agentKey: string): void {
  void _agentKey;
}
