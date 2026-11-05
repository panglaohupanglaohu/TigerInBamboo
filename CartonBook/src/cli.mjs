#!/usr/bin/env node
/**
 * cli.mjs — CartonBook 命令行
 * node src/cli.mjs run|plan|capture|layout|export|layout-only --recipe <path>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planChapter } from "./planChapter.mjs";
import { captureShots } from "./captureShots.mjs";
import { layoutEdena } from "./layoutEdena.mjs";
import { exportBook } from "./exportBook.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARTON = path.resolve(__dirname, "..");

function usage() {
  console.log(`CartonBook — TigerMessenger 截屏卡通书

用法:
  node src/cli.mjs <command> --recipe <file> [options]

命令:
  plan          故事 → 镜头计划
  capture       按计划截屏
  layout        Edena 排版
  export        汇总 book.html
  run           plan → capture → layout → export
  layout-only   plan →（fixtures 截屏）→ layout → export

选项:
  --recipe <path>     recipe JSON（必填）
  --shots-dir <path>  使用已有 PNG 目录，跳过游戏
  --port <n>          静态服端口，默认 8766
  --chapter-dir <p>   覆盖产物目录
  --crop              启用策略2：安全中心裁切（CARTONBOOK_CROP=1 同效）

硬约束: 所有漫画图必须来自本游戏系统截屏；禁止文生图。
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--recipe" || a === "--shots-dir" || a === "--port" || a === "--chapter-dir") {
      args[a.slice(2)] = argv[++i];
    } else if (a.startsWith("--")) {
      args[a.slice(2)] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadRecipe(p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) {
    // 也试相对 CartonBook 根
    const alt = path.resolve(CARTON, p);
    if (!fs.existsSync(alt)) throw new Error(`找不到 recipe: ${p}`);
    return { recipe: JSON.parse(fs.readFileSync(alt, "utf8")), path: alt };
  }
  return { recipe: JSON.parse(fs.readFileSync(abs, "utf8")), path: abs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === "help" || args.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }
  if (!args.recipe) {
    console.error("缺少 --recipe");
    usage();
    process.exit(1);
  }

  const { recipe, path: recipePath } = loadRecipe(args.recipe);
  const chapterDir =
    args["chapter-dir"] ||
    path.join(CARTON, "chapters", recipe.id || "untitled");

  console.log(`[cartonbook] recipe=${recipePath}`);
  console.log(`[cartonbook] chapterDir=${chapterDir}`);
  console.log(`[cartonbook] command=${cmd}`);

  const runPlan = () => planChapter(recipe, { chapterDir });
  const runCapture = async (plan, extra = {}) =>
    captureShots(plan, {
      chapterDir,
      port: args.port ? Number(args.port) : undefined,
      shotsDir: args["shots-dir"],
      cropInset: args.crop ? true : undefined,
      ...extra,
    });
  const runLayout = (plan) => layoutEdena(plan, { chapterDir });
  const runExport = (plan, layoutResult) =>
    exportBook(plan, { chapterDir, layoutResult });

  if (cmd === "plan") {
    const { planPath } = runPlan();
    console.log("[ok] plan →", planPath);
    return;
  }

  if (cmd === "capture") {
    const { plan } = fs.existsSync(path.join(chapterDir, "plan.json"))
      ? {
          plan: JSON.parse(
            fs.readFileSync(path.join(chapterDir, "plan.json"), "utf8")
          ),
        }
      : runPlan();
    const manifest = await runCapture(plan);
    console.log(
      `[ok] capture realCapture=${manifest.realCapture} mode=${manifest.mode}`
    );
    return;
  }

  if (cmd === "layout") {
    const plan = JSON.parse(
      fs.readFileSync(path.join(chapterDir, "plan.json"), "utf8")
    );
    const r = runLayout(plan);
    console.log("[ok] layout pages:", r.written.map((w) => w.file).join(", "));
    return;
  }

  if (cmd === "export") {
    const plan = JSON.parse(
      fs.readFileSync(path.join(chapterDir, "plan.json"), "utf8")
    );
    const r = runExport(plan);
    console.log("[ok] book →", r.bookPath);
    return;
  }

  if (cmd === "layout-only") {
    const { plan, planPath } = runPlan();
    console.log("[ok] plan →", planPath);
    const manifest = await runCapture(plan, { useFixtures: true });
    console.log(
      `[ok] fixtures mode=${manifest.mode} realCapture=${manifest.realCapture}`
    );
    const layoutResult = runLayout(plan);
    console.log(
      "[ok] layout:",
      layoutResult.written.map((w) => w.file).join(", ")
    );
    const exp = runExport(plan, layoutResult);
    console.log("[ok] book →", exp.bookPath);
    console.log(
      "\n打开:",
      exp.bookPath,
      "\n或 viewer:",
      path.join(CARTON, "viewer/index.html")
    );
    return;
  }

  if (cmd === "run") {
    const { plan, planPath } = runPlan();
    console.log("[ok] plan →", planPath);
    const manifest = await runCapture(plan);
    console.log(
      `[ok] capture realCapture=${manifest.realCapture} mode=${manifest.mode}`
    );
    if (manifest.captureError) {
      console.warn("[warn] live capture error:", manifest.captureError);
    }
    const layoutResult = runLayout(plan);
    console.log(
      "[ok] layout:",
      layoutResult.written.map((w) => w.file).join(", ")
    );
    const exp = runExport(plan, layoutResult);
    console.log("[ok] book →", exp.bookPath);
    console.log(
      "\n打开:",
      exp.bookPath,
      "\nviewer:",
      path.join(CARTON, "viewer/index.html")
    );
    console.log(
      `\n截屏真实性: realCapture=${manifest.realCapture} mode=${manifest.mode}`
    );
    return;
  }

  console.error("未知命令:", cmd);
  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error("[cartonbook] 失败:", e.message || e);
  process.exit(1);
});
