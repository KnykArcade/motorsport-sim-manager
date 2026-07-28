export type CareerCreationResult = 'cancelled' | 'completed' | 'duplicate' | 'failed';

export interface CareerCreationCoordinator {
  isActive(): boolean;
  release(): void;
  tryAcquire(): boolean;
}

export function createCareerCreationCoordinator(): CareerCreationCoordinator {
  let active = false;

  return {
    isActive: () => active,
    release: () => {
      active = false;
    },
    tryAcquire: () => {
      if (active) return false;
      active = true;
      return true;
    },
  };
}

export async function executeCareerCreation({
  coordinator,
  confirmStart,
  initialize,
  onCreating,
  onFailure,
  onReady,
}: {
  coordinator: CareerCreationCoordinator;
  confirmStart: () => boolean;
  initialize: () => Promise<void>;
  onCreating: () => void;
  onFailure: () => void;
  onReady: () => void;
}): Promise<CareerCreationResult> {
  if (!coordinator.tryAcquire()) return 'duplicate';

  if (!confirmStart()) {
    coordinator.release();
    return 'cancelled';
  }

  onCreating();

  try {
    await initialize();
  } catch {
    coordinator.release();
    onFailure();
    return 'failed';
  }

  onReady();
  return 'completed';
}
