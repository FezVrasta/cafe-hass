# C.A.F.E.（汉化版）

**C**omplex **A**utomation **F**low **E**ditor —— Home Assistant 的可视化自动化流编辑器，零额外开销。

本仓库是 [FezVrasta/cafe-hass](https://github.com/FezVrasta/cafe-hass) 的汉化分支，
在保留上游全部功能的基础上补齐了简体中文界面，并每月自动与上游同步。

## 与原版的区别

| 项目 | 说明 |
| --- | --- |
| 前端界面 | 补齐 `zh-Hans` 简体中文语料（`common` / `nodes` / `dialogs` / `errors` / `panels` / `simulator` / `debug`） |
| 集成配置 | 新增 `custom_components/cafe/translations/zh-Hans.json`，添加集成时也是中文 |
| 语言切换 | 跟随 Home Assistant 界面语言自动切换（HA 语言设为「简体中文」即可） |
| 自动同步 | 每月自动合并上游更新并发布新版本 |

除此之外没有任何功能性改动，生成出来的 YAML 与原版完全一致。

## 安装（HACS）

1. 确保已安装 [HACS](https://hacs.xyz/)。
2. HACS → **集成** → 右上角 ⋮ → **自定义存储库**。
3. 存储库地址填 `https://github.com/summ9919/cafe-hass`，类别选 **Integration**。
4. 搜索 **C.A.F.E.** 下载，重启 Home Assistant。
5. **设置** → **设备与服务** → **添加集成** → 搜索 **C.A.F.E.**。

## 使用中文界面

**设置** → **系统** → **通用**（或个人资料）里把语言改成 **简体中文（zh-Hans）**，
重新打开 C.A.F.E. 面板即为中文。语言取自 Home Assistant 的 `hass.language`，无需在插件内单独设置。

## 手动安装（不用 HACS）

1. 到本仓库 [Releases](https://github.com/summ9919/cafe-hass/releases) 下载 `cafe.zip`。
2. 解压到 Home Assistant 配置目录下的 `custom_components/cafe/`。
3. 重启 Home Assistant，然后按上面的步骤添加集成。

## 关于安全

项目仍处于 Beta。它生成的都是标准 HA 原生 YAML，不会引入额外引擎，
但编辑前请照例备份你的自动化配置。

## 上游与许可

- 上游：<https://github.com/FezVrasta/cafe-hass>
- 许可：沿用上游 LICENSE（MIT）
