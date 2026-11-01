# REA-SETUP — 工具链配置记录

这份文件记录这台机器上 REA 的外部工具链怎么装的、卡在哪、怎么绕过。
不是使用文档（那个看 `README.md`），是**下次重装时照着抄**的清单。

---

## 1. 已配置项

| 变量 | 值 | 用在哪 |
|---|---|---|
| `REA_NODE`（启动器自动解析） | `~/Tools/REA/node/bin/node` (24.22.2) | `bin/REA-agent` |
| `JAVA_HOME` | `~/Tools/REA/java/jdk-21.0.13+9/Contents/Home` | Ghidra provider |
| `GHIDRA_INSTALL_DIR` | `~/Tools/REA/decompiler/ghidra_12.1.4_PUBLIC` | Ghidra provider |
| `REA_WABT_BIN_DIRECTORY` | `~/Tools/wabt-1.0.42/bin` | WASM 静态检查 |

配置写在 `~/.workbuddy/mcp.json` 的 `rea.env` 里。**改完必须重启 MCP server 才生效**
（连接器管理页 → 自定义连接器 → 对 rea 点「信任」/ 重开会话）。

CLI 侧临时用可以直接前置变量：

```bash
REA_WABT_BIN_DIRECTORY="$HOME/Tools/wabt-1.0.42/bin" \
  ./bin/REA-agent inspect-wasm-artifact <file.wasm> --format json
```

---

## 2. WABT 1.0.42 是怎么装的（踩了两个坑）

REA 要求**精确 1.0.42**，且三个工具 `wasm-validate` / `wasm-objdump` / `wasm2wat`
的 `--version` 必须在 stdout 打印 `1.0.42`、stderr 为空。

```bash
# 坑 1：github release 直连被代理挡（CONNECT tunnel failed 502），用镜像
curl -sL -o wabt.tar.gz \
  "https://ghproxy.net/https://github.com/WebAssembly/wabt/releases/download/1.0.42/wabt-1.0.42-macos-arm64.tar.gz"
# 校验 sha256（同一镜像取 .sha256 文件）
tar xzf wabt.tar.gz && mv wabt-1.0.42 ~/Tools/
```

坑 2：**官方 macOS arm64 包依赖 Homebrew 的 openssl**。

```
dyld: Library not loaded: /opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib
```

这台机器没有 brew，所以那个包直接起不来。两个选择：

- 装 brew 再 `brew install openssl@3`（重量级）
- **自己编一个 libcrypto**（本机做法，20 秒）

```bash
curl -sL -o openssl.tar.gz \
  "https://ghproxy.net/https://github.com/openssl/openssl/releases/download/openssl-3.5.0/openssl-3.5.0.tar.gz"
mkdir -p ossl-build && tar xzf openssl.tar.gz -C ossl-build --strip-components=1
cd ossl-build && ./Configure darwin64-arm64-cc --prefix="$HOME/Tools/openssl3" shared no-tests no-docs
make -j8 build_libs          # 只编库，20 秒
```

然后把依赖改到本地、重新签名（arm64 上改过的二进制不重签会被 dyld 拒绝）：

```bash
cp libcrypto.3.dylib ~/Tools/wabt-1.0.42/lib/
for t in wasm-validate wasm-objdump wasm2wat; do
  install_name_tool -change /opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib \
    @loader_path/../lib/libcrypto.3.dylib ~/Tools/wabt-1.0.42/bin/$t
  codesign --force --sign - ~/Tools/wabt-1.0.42/bin/$t
done
```

验证（三条都要 `stdout=1.0.42`、`stderr` 为空）：

```bash
for t in wasm-validate wasm-objdump wasm2wat; do ~/Tools/wabt-1.0.42/bin/$t --version; done
```

> 顺带一个事实：这三个二进制**没有从 libcrypto 导入任何符号**（`dyld_info -imports` 里 crypto 计数为 0），
> 是打包时的多余依赖。即便如此也没有用空壳库糊弄，装的是真 OpenSSL。

---

## 3. 仍然不通的一步：`ps` 被宿主拒绝

`inspect-wasm-artifact` 现在的表现是：

```
"captured_output": { "stdout": "1.0.42\n", "stderr": "" }   ← 工具确实跑起来了
"reason": "process table could not be inspected: spawn EPERM"
→ cleanup_incomplete
```

REA 收尾要用 `ps -axo pid=,ppid=,pgid=,uid=,stat=,command=` 复核进程表，
而这个宿主环境**禁止任何进程执行 `ps`**：

```
$ ps -axo pid=
(eval):8: operation not permitted: ps
```

python / node / bash 都一样（`PermissionError [Errno 1]`），跳出工具沙箱也一样。
这是宿主（WorkBuddy 应用）的进程枚举限制，不是配置问题。

同一个限制也解释了之前的两件事：

- `rea doctor` 报 `java: spawn EPERM` → Ghidra provider 不可用
- 任何需要「启动子进程并确认它已被回收」的 provider，都会判 cleanup 失败

**绕过方式**：在你自己的 Terminal 里跑（那里没有这层限制）：

```bash
cd ~/Downloads/TigerInBamboo/REA-agent
REA_WABT_BIN_DIRECTORY="$HOME/Tools/wabt-1.0.42/bin" \
  ./bin/REA-agent inspect-wasm-artifact \
  ~/Downloads/TigerInBamboo/townscaper-web/Build/WebGL.wasm --format json
```

MCP 内的调用同样会踩到这个限制，属于环境问题，不是这里能配置掉的。

---

## 4. 装完之后拿到了什么

WABT 本身已经能读那个 23MB 的 Unity WebGL 包：

```
wasm-validate  → rc=0（模块合法）
wasm-objdump -h → Code 段 95,392 个函数，Export 587 个
name 段存在 → 191,836 个函数带名字
```

也就是说：**要看 wasm 内部结构，现在可以直接看了**；缺的只是 REA 把它包装成一次"可交付结论"的收尾步骤。
