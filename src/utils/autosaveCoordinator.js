export const createAutosaveCoordinator = ({ save, delayMs = 2000, onError = () => {} }) => {
  let revision = 0;
  let timer = null;
  let pending = null;
  let inFlight = false;
  let baselineEstablished = false;
  let idleWaiters = [];

  const resolveIdle = () => {
    if (timer || pending || inFlight) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const drain = async () => {
    if (inFlight || !pending) {
      resolveIdle();
      return;
    }

    const task = pending;
    pending = null;
    inFlight = true;
    try {
      await save(task.value, task.revision);
    } catch (error) {
      onError(error, task);
    } finally {
      inFlight = false;
      if (pending) void drain();
      else resolveIdle();
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void drain();
    }, delayMs);
  };

  const whenIdle = () => {
    if (!timer && !pending && !inFlight) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  };

  return {
    resetBaseline() {
      baselineEstablished = true;
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
      baselineEstablished = true;
      revision += 1;
      pending = { value, revision };
      if (timer) clearTimeout(timer);
      timer = null;
      void drain();
      return whenIdle();
    },
    whenIdle,
    dispose() {
      pending = null;
      if (timer) clearTimeout(timer);
      timer = null;
      resolveIdle();
    }
  };
};
