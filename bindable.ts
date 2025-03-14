import {
  CreateSignalOptions,
  DestroyRef,
  Injector,
  Signal,
  WritableSignal,
  assertNotInReactiveContext,
  effect,
  inject,
  isSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MonoTypeOperatorFunction, Observable, asapScheduler, observeOn, pipe } from 'rxjs';

export type BindableSignal<T> = WritableSignal<T> & {
  bindTo: (source: Observable<T> | Signal<T>) => WritableSignal<T>;
};

export function bindable<T>(
  initialValue: T,
  options?: CreateSignalOptions<T> & {
    destroyRef?: DestroyRef;
    injector?: Injector;
    manualCleanup?: boolean;
  },
): BindableSignal<T> {
  assertNoDestroyRefOrInjectorProvidedWithManualCleanup(options);

  let injector: Injector | undefined = undefined;
  if (options?.destroyRef === undefined && options?.manualCleanup !== true) {
    injector = options?.injector ?? inject(Injector);
  }

  const bindableSignal = signal<T>(initialValue, options);

  let bound = false;
  const bindTo: (source: Observable<T> | Signal<T>) => WritableSignal<T> = (
    source: Observable<T> | Signal<T>,
  ) => {
    assertNotInReactiveContext(
      bindTo,
      'Invoking `bindTo` causes new subscriptions every time. ' +
        'Consider moving `bindTo` outside of the reactive context and read the signal value where needed.',
    );
    if (bound) {
      throw new Error('Signal is already bound to an observable.');
    }
    if (isSignal(source)) {
      if (injector === undefined) {
        throw new Error(
          'Tried to bind the signal to a signal without a provided Injector. In this case the bindTo method is creating an effect and there is no ' +
            'possibility to provide a terminator operator unlike with observables. To prevent memory leaks the Injector has to be provided or the ' +
            'bindable() factory method needs to be called in injection context. Providing the DestroyRef will make the Injector undefined.',
        );
      }
      effect(() => bindableSignal.set(source()), {
        injector,
        allowSignalWrites: true,
      });
    } else {
      let operatorFunction: MonoTypeOperatorFunction<T>;
      if (options?.manualCleanup === true) {
        operatorFunction = pipe();
      } else {
        const destroyRef = options?.destroyRef ?? injector?.get(DestroyRef);
        if (destroyRef === undefined) {
          throw new Error(
            'Using the bindable() factory function in injection context or prodiving the DestroyRef ' +
              'or the Injector is required when not using manual cleanup to prevent memory leaks.',
          );
        }
        operatorFunction = takeUntilDestroyed(destroyRef);
      }

      source
        .pipe(
          // Writing to signals is not allowed in a `computed` or an `effect` by default so we need to use the
          // asapScheduler to ensure that the value is set in the next microtask. This will cause the returned
          // signal to have the initial value first before we have an update from the observable.
          observeOn(asapScheduler),
          operatorFunction,
        )
        .subscribe(value => bindableSignal.set(value));
    }
    bound = true;
    return bindableSignal;
  };

  return Object.assign(bindableSignal, { bindTo }) as BindableSignal<T>;
}

function assertNoDestroyRefOrInjectorProvidedWithManualCleanup(options?: {
  manualCleanup?: boolean;
  destroyRef?: DestroyRef;
  injector?: Injector;
}): void {
  if (options?.manualCleanup === true) {
    if (options?.destroyRef !== undefined || options?.injector !== undefined) {
      throw new Error(
        'When using manual cleanup, DestroyRef or Injector will not provide automated cleanup. ' +
          'Make sure that the operator functions contain the take or takeUntil operator to prevent memory leaks.',
      );
    }
  }
}
