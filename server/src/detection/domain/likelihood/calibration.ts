export const CALIBRATION = {
  meanLogProb: { mean: -3.0495, sd: 0.8266, weight: 3.0691 },
  logTokens: { mean: 4.1815, sd: 0.6126, weight: -1.0071 },
  bias: -2.3673,
  minTokens: 20,
  fullReliabilityTokens: 60,
  maxLogit: 3.5,
  // textes IA du corpus : 240 tokens max, pas d'extrapolation au-delà
  maxCalibratedTokens: 240,
};

export const MEASURED = [
  { tokens: 30, detected: 0.89, falsePositives: 0.19 },
  { tokens: 50, detected: 0.96, falsePositives: 0.14 },
  { tokens: 80, detected: 1, falsePositives: 0.1 },
  { tokens: 120, detected: 0.96, falsePositives: 0.07 },
  { tokens: 200, detected: 0.86, falsePositives: 0.02 },
];

export const CORPUS = '394 textes en français : 46 générés par IA, 348 écrits par des humains avant 2022';
