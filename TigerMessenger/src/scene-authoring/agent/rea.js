// REACodeRefactoring 的位置：游戏服务（backend main.py）把它挂在 /townscaper-web/REACodeRefactoring/。
// 本文件在 /TigerMessenger/src/scene-authoring/agent/ 下，向上四级就是站点根。
export const REA_BASE = new URL('../../../../townscaper-web/REACodeRefactoring/', import.meta.url);
export const rea = (path) => new URL(path, REA_BASE).href;
