import { Seq } from './seq';
import { setShared, useShared } from './store';

export type TabName = 'learn' | 'metro' | 'tuner' | 'chord' | 'fret' | 'train';
export type TrainMode = 'interval' | 'chordear' | 'rhythm' | 'form';

/** タブを切り替える（レッスンのデモ再生は止める） */
export function gotoTab(name: TabName): void {
  Seq.stop();
  setShared('tab', name);
  window.scrollTo(0, 0);
}
export const useTab = (): TabName => useShared<TabName>('tab', 'learn')[0];
export function gotoTrain(mode: TrainMode): void {
  setShared('trainMode', mode);
  gotoTab('train');
}
/** タブを切り替えたあと、指定した要素が見える位置までスクロールする */
export function scrollToId(id: string): void {
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }), 50);
}
