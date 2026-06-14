export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
): number {
  const predGD = predictedHome - predictedAway;
  const actualGD = actualHome - actualAway;
  const correctWinner = Math.sign(predGD) === Math.sign(actualGD);
  if (!correctWinner) return 0;

  const exact = predictedHome === actualHome && predictedAway === actualAway;
  if (exact) return 5;

  const perfectGD = predGD === actualGD;
  if (perfectGD) return 3;

  const closeScores =
    Math.abs(predictedHome - actualHome) <= 1 &&
    Math.abs(predictedAway - actualAway) <= 1;
  if (closeScores) return 2;

  return 1;
}
