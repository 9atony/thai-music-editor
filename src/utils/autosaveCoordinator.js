export const createAutosaveCoordinator = ({
  save,
  delayMs = 2000,
  retryDelays = [1000, 3000, 10000, 30000],
  onError = () => {},
}) => {
  let revision = 0;
  let timer = null;
  let pending = null;
  let inFlight = false;
  let baselineEstablished = false;
  let retryAttempt = 0;
  let disposed = false;
  let lastSuccessfulRevision = 0;
  let idleWaiters = [];

  const resolveIdle = () => {
    if (timer || pending || inFlight) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const schedule = (waitMs = delayMs) => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void drain();
    }, waitMs);
  };

  const drain = async () => {
    if (disposed || inFlight || !pending) {
      resolveIdle();
      return;
    }

    const task = pending;
    pending = null;
    inFlight = true;
    try {
      await save(task.value, task.revision);
      lastSuccessfulRevision = Math.max(lastSuccessfulRevision, task.revision);
      retryAttempt = 0;
    } catch (error) {
      const shouldRetry = onError(error, task) !== false;
      if (shouldRetry && !disposed) {
        if (!pending || pending.revision <= task.revision) pending = task;
        const retryIndex = Math.min(retryAttempt, Math.max(retryDelays.length - 1, 0));
        const retryDelay = retryDelays.length > 0 ? retryDelays[retryIndex] : delayMs;
        retryAttempt += 1;
        schedule(retryDelay);
      } else {
        retryAttempt = 0;
      }
    } finally {
      inFlight = false;
      if (pending && !timer && !disposed) void drain();
      else resolveIdle();
    }
  };

  const whenIdle = () => {
    if (!timer && !pending && !inFlight) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  };

  return {
    resetBaseline() {
      baselineEstablished = true;
      retryAttempt = 0;
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      resolveIdle();
    },
    markDirty(value) {
      if (!baselineEstablished) {
        baselineEstablished = true;
        pending = null;
        if (timer) clearTimeout(timer);
        timer = null;
        resolveIdle();
        return 0;
      }
      revision += 1;
      pending = { value, revision };
      schedule();
      return revision;
    },
    saveNow(value) {
      if (disposed) return Promise.resolve(false);
      baselineEstablished = true;
      revision += 1;
      const targetRevision = revision;
      pending = { value, revision: targetRevision };
      if (timer) clearTimeout(timer);
      timer = null;
      void drain();
      return whenIdle().then(() => lastSuccessfulRevision >= targetRevision);
    },
    retryNow() {
      if (disposed || (!pending && !inFlight)) return whenIdle();
      if (timer) clearTimeout(timer);
      timer = null;
      void drain();
      return whenIdle();
    },
    hasPending() {
      return Boolean(timer || pending || inFlight);
    },
    whenIdle,
    dispose() {
      disposed = true;
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      resolveIdle();
    }
  };
};
