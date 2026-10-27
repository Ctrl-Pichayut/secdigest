import type { PracticeCard } from './types';
import python from './cards/python.json';
import c from './cards/c.json';
import js from './cards/js.json';
import java from './cards/java.json';

/**
 * The bundled starter bank. Each language file is in learning-path order:
 * new cards are introduced top to bottom. Structure and every "predict the
 * output" answer are checked by scripts/verify_practice_cards.py, which runs
 * the code for real. Generated cards are added on top by remoteCards.ts.
 */
export const STARTER_CARDS: PracticeCard[] = [...python, ...c, ...js, ...java] as unknown as PracticeCard[];
