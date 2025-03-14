import { ChangeDetectorRef, DestroyRef, Injector, ProviderToken, signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MockProxy, mock } from 'jest-mock-extended';
import { BehaviorSubject, take } from 'rxjs';
import { bindable } from './bindable';

describe('bindable', () => {
  it('should update the bindable signal if the updater observable has been emitted', fakeAsync(() => {
    const newValue = 'newValue';
    const upadterSource = new BehaviorSubject(newValue);
    const bindableSignal = TestBed.runInInjectionContext(() => bindable('initialValue'));

    bindableSignal.bindTo(upadterSource);
    tick();

    expect(bindableSignal()).toBe(newValue);

    const anotherValue = 'anotherValue';
    upadterSource.next(anotherValue);
    tick();

    expect(bindableSignal()).toBe(anotherValue);
  }));

  it('should update the bindable signal if the updater signal has been emitted', fakeAsync(() => {
    const newValue = 'newValue';
    const updaterSignal = signal(newValue);
    const bindableSignal = TestBed.runInInjectionContext(() => bindable('initialValue'));

    bindableSignal.bindTo(updaterSignal);
    tick();

    expect(bindableSignal()).toBe(newValue);

    const anotherValue = 'anotherValue';
    updaterSignal.set(anotherValue);
    tick();

    expect(bindableSignal()).toBe(anotherValue);
  }));

  it('should require injection context if injector or destroyRef is not provided and manualCleanup is false', () => {
    expect(() => bindable('initialValue')).toThrow();
  });

  it('should not require injection context if injector is provided', () => {
    const injector = TestBed.inject(Injector);
    const bindableSignal = bindable('initialValue', { injector });

    expect(bindableSignal()).toBeTruthy();
  });

  it('should not require injection context if destroyRef is provided', () => {
    const destroyRef = TestBed.inject(DestroyRef);
    const bindableSignal = bindable('initialValue', { destroyRef });

    expect(bindableSignal()).toBeTruthy();
  });

  it('should not require injection context if manualCleanup is true', () => {
    const bindableSignal = bindable('initialValue', { manualCleanup: true });

    expect(bindableSignal()).toBeTruthy();
  });

  it('should throw if manualCleanup is true and injector is provided', () => {
    const injector = TestBed.inject(Injector);

    expect(() => bindable('initialValue', { manualCleanup: true, injector })).toThrow();
  });

  it('should throw if manualCleanup is true and destroyRef is provided', () => {
    const destroyRef = TestBed.inject(DestroyRef);

    expect(() => bindable('initialValue', { manualCleanup: true, destroyRef })).toThrow();
  });

  it('bindTo should throw if manualCleanup is true and it is binding to a signal', () => {
    const bindableSignal = TestBed.runInInjectionContext(() =>
      bindable('initialValue', { manualCleanup: true }),
    );

    expect(() => bindableSignal.bindTo(signal('newValue'))).toThrow();
  });

  it('bindTo should throw if destroyRef provided and it is binding to a signal', () => {
    const destroyRef = TestBed.inject(DestroyRef);
    const bindableSignal = TestBed.runInInjectionContext(() =>
      bindable('initialValue', { destroyRef }),
    );

    expect(() => bindableSignal.bindTo(signal('newValue'))).toThrow();
  });

  it('bindTo should not throw if injector was provided, it is binding to a signal and the bindable signal was created outside of injection context', fakeAsync(() => {
    const newValue = 'newValue';
    const injector = TestBed.inject(Injector);
    const bindableSignal = bindable('initialValue', { injector });

    bindableSignal.bindTo(signal(newValue));
    tick();

    expect(bindableSignal()).toBe(newValue);
  }));

  it('should stop updating the bindable signal from an observable if the DestroyRef onDestroy callback was called', fakeAsync(() => {
    const destroyRef = mock<DestroyRef>();
    const onDestroyHooks: (() => void)[] = [];
    collectMockDestroyRefCallbacks(destroyRef, onDestroyHooks);
    const newValue = 'newValue';
    const upadterSource = new BehaviorSubject(newValue);
    const bindableSignal = bindable('initialValue', { destroyRef });

    bindableSignal.bindTo(upadterSource);
    tick();

    expect(bindableSignal()).toBe(newValue);

    onDestroyHooks.forEach(destroy => destroy());
    const anotherValue = 'anotherValue';
    upadterSource.next(anotherValue);
    tick();

    expect(bindableSignal()).toBe(newValue);
  }));

  it('should stop updating the bindable signal from an observable if the injected DestroyRef onDestroy callback was called', fakeAsync(() => {
    const injector = mock<Injector>();
    const destroyRef = mock<DestroyRef>();
    injector.get.mockReturnValue(destroyRef);
    const onDestroyHooks: (() => void)[] = [];
    collectMockDestroyRefCallbacks(destroyRef, onDestroyHooks);
    const newValue = 'newValue';
    const upadterSource = new BehaviorSubject(newValue);
    const bindableSignal = bindable('initialValue', { injector });

    bindableSignal.bindTo(upadterSource);
    tick();

    expect(bindableSignal()).toBe(newValue);

    onDestroyHooks.forEach(destroy => destroy());
    const anotherValue = 'anotherValue';
    upadterSource.next(anotherValue);
    tick();

    expect(bindableSignal()).toBe(newValue);
  }));

  it('should stop updating the bindable signal from an observable if the observable was terminated', fakeAsync(() => {
    const newValue = 'newValue';
    const upadterSource = new BehaviorSubject(newValue);
    const bindableSignal = bindable('initialValue', { manualCleanup: true });

    bindableSignal.bindTo(upadterSource.pipe(take(1)));
    tick();

    expect(bindableSignal()).toBe(newValue);

    const anotherValue = 'anotherValue';
    upadterSource.next(anotherValue);
    tick();

    expect(bindableSignal()).toBe(newValue);
  }));

  it('should stop updating the bindable signal from a signal if the injected DestroyRef onDestroy callback was called', fakeAsync(() => {
    const injector = TestBed.inject(Injector);
    const destroyRef = mock<DestroyRef>();
    const originalGet = injector.get.bind(injector);
    spyOn(injector, 'get').and.callFake((token: ProviderToken<unknown>) => {
      if (token === DestroyRef) {
        return destroyRef;
      } else if (token === ChangeDetectorRef) {
        // ChangeDetectorRef is required for the effect
        return mock<ChangeDetectorRef>();
      }
      return originalGet(token);
    });
    const onDestroyHooks: (() => void)[] = [];
    collectMockDestroyRefCallbacks(destroyRef, onDestroyHooks);
    const newValue = 'newValue';
    const upadterSignal = signal(newValue);
    const bindableSignal = bindable('initialValue', { injector });

    bindableSignal.bindTo(upadterSignal);
    tick();

    expect(bindableSignal()).toBe(newValue);

    onDestroyHooks.forEach(destroy => destroy());
    const anotherValue = 'anotherValue';
    upadterSignal.set(anotherValue);
    tick();

    expect(bindableSignal()).toBe(newValue);
  }));
});

function collectMockDestroyRefCallbacks(
  mockDestroyRef: MockProxy<DestroyRef>,
  onDestroyHooks: (() => void)[],
) {
  mockDestroyRef.onDestroy.mockImplementation(fn => {
    onDestroyHooks.push(fn);
    return () => fn;
  });
}
