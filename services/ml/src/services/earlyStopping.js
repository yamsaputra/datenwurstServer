// Custom early-stopping with weight restoration. TF.js's built-in
// tf.callbacks.earlyStopping supports monitor/minDelta/patience/baseline but
// -- unlike Python Keras -- has no restoreBestWeights option, so without
// this, training would keep whatever weights existed at the moment patience
// ran out, not the best ones seen.
//
// Replaces the old fixed 50 epochs: at 71 windows / batch 32 that was only
// 3 batches/epoch, i.e. 150 gradient steps total -- under-trained toward the
// mean, not overfitted. Raising the epoch count alone would move it straight
// from "predicts the mean" to "memorizes the windows" with no useful regime
// in between, which is why early stopping (not a bigger fixed number) is the
// fix.
//
// Monitors val_mae, not val_loss: Huber's curvature makes its scale hard to
// compare across runs, while MAE is directly interpretable in occupants.

export function createEarlyStopping(model, { monitor = 'val_mae', patience = 10, minDelta = 0.05 } = {}) {
  let bestValue = Infinity;
  let bestWeights = null;
  let patienceCounter = 0;
  let stoppedEpoch = null;

  const onEpochEnd = async (epoch, logs) => {
    const current = logs[monitor];
    if (current === undefined || current === null) return;

    if (current < bestValue - minDelta) {
      bestValue = current;
      patienceCounter = 0;
      disposeBestWeights();
      bestWeights = model.getWeights().map(w => w.clone());
    } else {
      patienceCounter++;
      if (patienceCounter >= patience) {
        model.stopTraining = true;
        stoppedEpoch = epoch;
      }
    }
  };

  function disposeBestWeights() {
    if (bestWeights) bestWeights.forEach(w => w.dispose());
  }

  return {
    callbacks: { onEpochEnd },
    /** Call after model.fit() resolves -- sets the model's weights back to
     * whichever epoch had the best monitored value, then frees the snapshot. */
    restoreBest() {
      if (bestWeights) {
        model.setWeights(bestWeights);
        disposeBestWeights();
        bestWeights = null;
      }
    },
    getBestValue: () => (bestValue === Infinity ? null : bestValue),
    getStoppedEpoch: () => stoppedEpoch,
  };
}
