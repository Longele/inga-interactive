/* A separate balanced AC-line experiment; it never writes to the site's dispatcher. */
(() => {
  'use strict';
  const inputVoltage = 20, resistance = 10;
  function calculate(power, voltage) {
    if (typeof power !== 'number' || !Number.isFinite(power) || power < 0 || power > 2000 ||
        typeof voltage !== 'number' || !Number.isFinite(voltage) || voltage < 200 || voltage > 400) return null;
    const current = 1000 * power / (Math.sqrt(3) * voltage);
    const loss = 3 * resistance * current * current / 1e6;
    const referenceCurrent = 1000 * power / (Math.sqrt(3) * 200);
    const referenceLoss = 3 * resistance * referenceCurrent * referenceCurrent / 1e6;
    return Object.freeze({
      power, voltage, inputVoltage, resistance, current, loss, received: power - loss,
      inputCurrent: 1000 * power / (Math.sqrt(3) * inputVoltage), ratio: voltage / inputVoltage,
      receivingVoltage: voltage - Math.sqrt(3) * current * resistance / 1000,
      referenceCurrent, referenceLoss, saving: referenceLoss - loss,
      savingPercent: power > 0 ? (1 - loss / referenceLoss) * 100 : 0
    });
  }
  window.IngaTransformerModel = Object.freeze({ calculate });
})();
