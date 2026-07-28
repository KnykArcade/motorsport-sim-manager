import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PrincipalCreator } from './PrincipalCreator';
import {
  createCareerCreationCoordinator,
  executeCareerCreation,
} from './newCareerCreation';

function deferred() {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('career creation loading flow', () => {
  it('keeps the setup inert and exposes accessible loading and retry feedback', () => {
    const screen = readFileSync(new URL('NewCareer.tsx', import.meta.url), 'utf8');

    expect(screen).toContain('aria-busy={isCreatingCareer}');
    expect(screen).toContain('inert={isCreatingCareer}');
    expect(screen).toContain('role="status"');
    expect(screen).toContain('Building your motorsport universe');
    expect(screen).toContain('Loading historical records and preparing team headquarters.');
    expect(screen).toContain('Retry');
  });

  it('announces loading immediately, ignores a repeated start, and completes once', async () => {
    const coordinator = createCareerCreationCoordinator();
    const initialization = deferred();
    const onCreating = vi.fn();
    const onReady = vi.fn();
    const initialize = vi.fn(() => initialization.promise);
    const options = {
      coordinator,
      confirmStart: () => true,
      initialize,
      onCreating,
      onFailure: vi.fn(),
      onReady,
    };

    const first = executeCareerCreation(options);
    const repeated = await executeCareerCreation(options);

    expect(onCreating).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(repeated).toBe('duplicate');
    expect(onReady).not.toHaveBeenCalled();

    initialization.resolve();
    await expect(first).resolves.toBe('completed');
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(coordinator.isActive()).toBe(true);
  });

  it('unlocks after initialization failure so Retry can succeed', async () => {
    const coordinator = createCareerCreationCoordinator();
    const onFailure = vi.fn();
    const onReady = vi.fn();

    await expect(executeCareerCreation({
      coordinator,
      confirmStart: () => true,
      initialize: () => Promise.reject(new Error('registry unavailable')),
      onCreating: vi.fn(),
      onFailure,
      onReady,
    })).resolves.toBe('failed');

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(coordinator.isActive()).toBe(false);

    await expect(executeCareerCreation({
      coordinator,
      confirmStart: () => true,
      initialize: () => Promise.resolve(),
      onCreating: vi.fn(),
      onFailure,
      onReady,
    })).resolves.toBe('completed');

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when overwrite confirmation is cancelled', async () => {
    const coordinator = createCareerCreationCoordinator();
    const initialize = vi.fn();

    await expect(executeCareerCreation({
      coordinator,
      confirmStart: () => false,
      initialize,
      onCreating: vi.fn(),
      onFailure: vi.fn(),
      onReady: vi.fn(),
    })).resolves.toBe('cancelled');

    expect(initialize).not.toHaveBeenCalled();
    expect(coordinator.isActive()).toBe(false);
  });

  it('disables both principal confirmation buttons while creation is active', () => {
    const html = renderToStaticMarkup(createElement(PrincipalCreator, {
      teamName: 'Test Team',
      confirmLabel: 'Start Career',
      isSubmitting: true,
      onBack: () => undefined,
      onConfirm: () => undefined,
    }));

    expect(html.match(/Creating Career…/g)).toHaveLength(2);
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
