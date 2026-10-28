import type { Job, Tx } from '../queue';

export interface JobHandler {
  /**
   * Does the slow work outside any transaction, then returns the writes that
   * record its result. The queue runs those in the transaction that marks the
   * job succeeded.
   */
  run(job: Job): Promise<(tx: Tx) => Promise<void>>;
  /** Called once the job has failed for good, to mark whatever it was working on. */
  onFailed?(job: Job, error: string): Promise<void>;
}
