// Реестр форматов конкурсов.
// Чтобы добавить новый формат: положи рядом файл по образцу и допиши его сюда.

import quiz from './quiz.js';
import bets from './bets.js';
import quotes from './quotes.js';
import videoChoice from './videoChoice.js';
import photoGuess from './photoGuess.js';
import trueFalse from './trueFalse.js';
import audioGuess from './audioGuess.js';
import challenge from './challenge.js';

export const TYPES = [quiz, bets, videoChoice, photoGuess, quotes, trueFalse, audioGuess, challenge];

const BY_ID = {};
for (const t of TYPES) BY_ID[t.id] = t;

export function getType(id) {
  return BY_ID[id] || quiz;
}
