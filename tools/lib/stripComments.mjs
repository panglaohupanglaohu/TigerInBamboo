/**
 * 剥离 JS 注释后再做禁用词扫描 —— 守卫测试需要检查【代码】而不是散文，
 * 否则「本文件不许用 new Date()」这样的说明注释本身会被判成违规。
 *
 * 逐行扫描并跟踪块注释与字符串状态。旧实现先用正则删块注释，结果一个
 * 出现在行注释里的块注释起始符会伪造出起点，一路吃到几百行之后的真结束符
 * ——2026-09-02 实测在 main.js 上吞掉 15KB 真代码，让守卫测试在一个被绞碎
 * 的文件上「通过」。
 *
 * 不识别正则字面量（那需要完整词法分析）。逐行处理是刻意的：万一误判，
 * 损害也被限制在那一行之内。
 */
export function stripComments(source) {
  const lines = String(source).split("\n");
  const out = [];
  let inBlock = false;

  for (const line of lines) {
    let result = "";
    let quote = null;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];

      if (inBlock) {
        if (ch === "*" && next === "/") { inBlock = false; i += 2; continue; }
        i++;
        continue;
      }
      if (quote) {
        result += ch;
        if (ch === "\\") { result += next ?? ""; i += 2; continue; }
        if (ch === quote) quote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        result += ch;
        i++;
        continue;
      }
      if (ch === "/" && next === "/") break;
      if (ch === "/" && next === "*") { inBlock = true; i += 2; continue; }
      result += ch;
      i++;
    }
    out.push(result);
  }
  return out.join("\n");
}
