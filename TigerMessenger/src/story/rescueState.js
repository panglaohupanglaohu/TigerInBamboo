// Serializable campaign rules. No DOM, renderer or engine dependency.
export const RESCUE_CHAPTERS = Object.freeze([
  { id: 'letter', title: '壹 · 借一封信，进入异乡', target: 'bookshop', place: '书店镇', action: '接过苍竹的信', text: '吱吱带来了消息：虎虎困在莫比斯湖沼。苍竹把一封给阿竹的信交给你。信使的身份，是穿过两个文明的通行证。' },
  { id: 'pact', title: '贰 · 叹息之门的约定', target: 'gate', place: '叹息之门', action: '交付密信，与英雄结盟', text: '奥德休斯提议以苍鹭为饵，将机队的注意力引向苔庭。阿喀琉斯答应掩护。你叮嘱他：不要入城，留意脚踝。' },
  { id: 'diversion', title: '叁 · 苔庭之下有鲲', target: 'saihoji', place: '苔庭', action: '送出诱敌信号', text: '鲲托起苔庭，传统文明的守军迎向机队。奥德休斯的计策争取到了时间。现在去旧港，找回八音盒前的红狐。' },
  { id: 'fox', title: '肆 · 八音盒前的红狐', target: 'fox', place: '红狐所在处', action: '把家书读给红狐', text: '她不能说话，却还记得八音盒的声音。你蹲下说：我们要好好说话，这个家得我们自己守护。红狐起身，与你同行。' },
  { id: 'tiger', title: '伍 · 荷与芭蕉', target: 'tiger', place: '莫比斯湖沼之虎', action: '回答灯谜，接虎虎回家', text: '「两家秋语一声？」你答：「荷与芭蕉。」虎虎认出了你。没等一家人说完话，机队的影子已经掠过湖面。' },
  { id: 'escape', title: '陆 · 越过高山圣城', target: 'citadel', place: '高山圣城', action: '带家人抵达圣城', text: '一家人越过圣城。回望时，阿喀琉斯仍在掩护，奥德休斯仍在奋战。你把未说完的话写进信里：我爱她，也爱她的妈妈，我们是一家人。' },
]);
export function restoreRescueState(value) {
  const index = Number.isInteger(value?.chapter) ? Math.max(0, Math.min(RESCUE_CHAPTERS.length, value.chapter)) : 0;
  return { version: 1, chapter: index, rescuedFox: index >= 4, rescuedTiger: index >= 5 };
}
export function advanceRescue(state, { target, distance, riding = false }) {
  const chapter = RESCUE_CHAPTERS[state.chapter];
  if (!chapter || chapter.target !== target || !Number.isFinite(distance) || distance > 9 || distance < 0) return false;
  if (riding && !['tiger', 'citadel'].includes(target)) return false;
  Object.assign(state, restoreRescueState({ chapter: state.chapter + 1 }));
  return true;
}
