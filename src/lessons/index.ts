import { BASICS } from './basics';
import { GUITAR } from './guitar';
import { THEORY } from './theory';
import type { Lesson } from './types';

/** レッスンの並び順。追加するときは各ファイルに書いて、ここに並べる */
export const LESSONS: Lesson[] = [...BASICS, ...THEORY, ...GUITAR];
