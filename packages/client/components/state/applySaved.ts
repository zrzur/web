import equal from "fast-deep-equal";

/**
 * Put data loaded from this device into the store. Data that needed
 * cleaning (a newer version wrote it, or a synced value that can't work
 * here) is saved back on this device only: it never goes to sync, so the
 * sync revision stays and other devices keep their own copy.
 */
export function applySaved<T>(
  key: string,
  data: T,
  clean: (data: T) => T,
  ops: {
    setStore: (key: string, value: T) => void;
    saveHere: (key: string) => void;
    /** writing that also touches sync: not used for loaded data */
    write?: (key: string, value: T) => void;
  },
) {
  const cleanData = clean(data);
  ops.setStore(key, cleanData);
  if (!equal(data, cleanData)) ops.saveHere(key);
}
