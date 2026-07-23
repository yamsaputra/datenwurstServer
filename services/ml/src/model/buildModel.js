import * as tf from '@tensorflow/tfjs-node';

const LOOKBACK  = 8;   // 4 hours of 30-min slots
const HORIZON   = 16;  // 8 hours of output
const FEATURES  = 20;  // was 18: is_semester (1 bool) replaced by a lecture/exam/break one-hot (3 dims), net +2

export function buildModel() {
  const model = tf.sequential();

  model.add(tf.layers.lstm({
    units: 64,
    returnSequences: true,
    dropout: 0.1,
    recurrentDropout: 0.1,
    inputShape: [LOOKBACK, FEATURES],
  }));

  model.add(tf.layers.lstm({
    units: 32,
    returnSequences: false,
    dropout: 0.1,
    recurrentDropout: 0.1,
  }));

  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: HORIZON, activation: 'linear' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: tf.losses.huberLoss,
    metrics: ['mae'],
  });

  return model;
}

export { LOOKBACK, HORIZON, FEATURES };
