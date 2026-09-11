export const createAsyncResourceCache = () => {
  const resolved = new Map();
  const pending = new Map();

  return {
    get(key) {
      return resolved.get(key);
    },
    load(key, loader) {
      if (resolved.has(key)) return Promise.resolve(resolved.get(key));
      if (pending.has(key)) return pending.get(key);

      const request = Promise.resolve()
        .then(loader)
        .then((value) => {
          pending.delete(key);
          resolved.set(key, value);
          return value;
        }, (error) => {
          pending.delete(key);
          throw error;
        });
      pending.set(key, request);
      return request;
    },
    clear() {
      resolved.clear();
      pending.clear();
    }
  };
};

