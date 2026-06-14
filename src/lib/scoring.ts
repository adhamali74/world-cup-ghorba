export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  joker: boolean = false,
): number {
  const predGD = predictedHome - predictedAway;
  const actualGD = actualHome - actualAway;
  const correctWinner = Math.sign(predGD) === Math.sign(actualGD);

  let pts: number;
  if (!correctWinner) pts = 0;
  else if (predictedHome === actualHome && predictedAway === actualAway) pts = 5;
  else if (predGD === actualGD) pts = 3;
  else if (
    Math.abs(predictedHome - actualHome) <= 1 &&
    Math.abs(predictedAway - actualAway) <= 1
  ) pts = 2;
  else pts = 1;

  return joker ? pts * 2 : pts;
}
