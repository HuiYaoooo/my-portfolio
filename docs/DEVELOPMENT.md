# 项目开发与部署说明

Hui Yao 的个人作品集网站，展示 AI 产品实践、实习与研究经历、设计项目和旅行摄影。

**在线访问：[yaohui.me](https://yaohui.me/)**

首页以一段带环境音的涟漪开场连接个人影像与作品内容。网站主体使用原生 HTML、CSS 和 JavaScript，通过 GitHub Pages 发布，无需安装 npm 依赖或执行构建命令。

## 网站内容

- **Home**：个人介绍、履历与项目入口。
- **Experience**：教育、实习、项目、创业经历及荣誉。
- **Projects**：作品概览、项目详情、演示与相关资料。
- **Photography**：按地点切换的环形摄影画廊与大图查看。
- **Contact**：联系方式及社交平台入口。
- **中英切换**：正文、导航和摄影文案随语言切换，并在本地保留语言偏好。

## 开场与声音

页面首先在全模糊状态下加载。视觉资源准备完成后，显示 **Click to enter**。

点击入口后，环境音与 **6 秒纯涟漪动画**一起启动：

| 阶段 | 表现 |
| --- | --- |
| 点击前 | 页面保持全模糊；音频可以静默缓冲，不自动播放 |
| 点击后前 1 秒 | 环境音从静音逐渐淡入 |
| 点击后前 1.8 秒 | 首页继续保持全模糊，涟漪开始扩散 |
| 随后 | 照片与文字在叠加的涟漪中逐渐清晰 |
| 第 6 秒 | 水面效果淡出，交回真实页面 |

开场只显示透明涟漪，没有下落雨丝、水滴轮廓或飞溅。左上角的 **SOUND ON / SOUND OFF** 可随时开关背景音，也可以在进入前先静音。音频在开场后继续循环播放，页面切到后台时暂停。

按 `Escape` 可跳过入口；动画开始后还可以使用 **SKIP INTRO** 跳过。非首页锚点链接会跳过开场。系统开启“减少动态效果”时保留静态入口，点击后直接进入页面，不播放涟漪。音频或 WebGL 不可用时，页面仍可进入。

Inter 与 Bodoni Moda 字体从 `assets/fonts/` 本地提供，避免外部字体样式阻塞入口脚本。脚本加载超时后保留可点击的入口；Safari 地址栏伸缩引起的纯高度变化不会提前结束涟漪。

## 技术与结构

网站主体使用原生 JavaScript、CSS 响应式布局、Canvas / WebGL 和 Web Audio API。图片、字体、项目资料与音频作为静态资源提供；`hihi-demo/` 包含已构建的独立演示资源。

```text
.
├── index.html                  # 首页结构、入口与资源引用
├── style.css                   # 主站样式与响应式布局
├── script.js                   # 中英文案、导航与页面交互
├── rain-intro.css              # 模糊入口、声音按钮与动画层样式
├── rain-intro.js               # 点击入场、6 秒涟漪与生命周期管理
├── rain-scene.js               # 将当前首屏照片与文字采样为纹理
├── rain-storm.js               # 涟漪位置与出现时序
├── rain-audio.js               # 音频预加载、淡入、静音及后台恢复
├── photography-arc.css         # 摄影画廊样式
├── photography-arc.js          # 城市切换、环形浏览与大图查看
├── photography/index.html      # 跳转至首页摄影区
├── hihi-demo/                  # HiHi 项目演示
├── assets/
│   ├── audio/                  # 网页环境音
│   ├── photography/            # 摄影图片与 manifest.json
│   └── …                       # 首页照片、字体、封面及项目资料
├── scripts/build_photography.py # 摄影素材处理脚本
└── CNAME                       # GitHub Pages 自定义域名
```

## 本地运行

需要 Python 3。在项目根目录启动静态服务器：

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

浏览器打开 [http://127.0.0.1:8765/](http://127.0.0.1:8765/)。停止服务时，在终端按 `Ctrl+C`。

请通过 HTTP 服务器预览，以便摄影清单请求、音频和纹理资源按网页环境正常加载。

### 开场预览参数

| 地址 | 用途 |
| --- | --- |
| `/?rain=preview` | 显示入口、重播按钮与可拖动时间轴 |
| `/?rain=preview&rain-frame=1800` | 查看指定毫秒位置的静止画面，不启动音频 |
| `/?rain=off` | 跳过开场，直接查看页面 |
| `/#photography` | 直接进入摄影区 |

## 内容维护

### 页面与语言

- 在 `index.html` 修改区块结构、链接和项目内容。
- 在 `script.js` 修改中英文案与语言映射；同时检查对应的 `data-i18n` 属性。
- 在 `style.css` 调整主站布局，在 `photography-arc.css` 调整画廊布局。
- 替换图片时保留正确的路径、宽高和适当的文件体积。

### 涟漪与音频

- `rain-intro.js` 的 `DURATION` 定义总时长。调整时长时，也需要同步检查 `render()` 中的时间映射、末段淡出及时间轴文案。
- `rain-storm.js` 控制涟漪出现的位置、时刻与强度，不负责绘制下落雨滴。
- `rain-audio.js` 的 `SOURCE` 指定音频路径，`LEVEL` 控制目标音量，`fadeTo(LEVEL, 1)` 定义首次播放的 1 秒淡入。
- 当前音频为 `assets/audio/pont-de-bourgogne.mp3`，保留约 246.49 秒完整录音，以 128 kbps 双声道 MP3 提供。源文件名为 `875471__nicotep__pontdebourgogne.wav`。
- 修改 CSS、JavaScript 或摄影清单后，同步更新引用中的版本参数，便于浏览器取得新资源。

### 摄影图片

画廊从 `assets/photography/manifest.json` 读取图片信息，城市文案与浏览顺序位于 `photography-arc.js`。

新增照片时，可使用处理脚本生成不同尺寸的 WebP 图片和清单。这个辅助脚本需要 Pillow；直接运行网站不需要安装它。

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install Pillow
python3 scripts/build_photography.py /path/to/photos assets/photography
```

源照片目录需按脚本中的 `CITY_SPECS` 组织。生成后检查照片方向、城市分类和大图显示，并更新画廊清单引用的缓存版本。

## 检查与发布

使用 Node.js 可检查主要 JavaScript 文件的语法：

```bash
node --check script.js
node --check photography-arc.js
node --check rain-intro.js
node --check rain-scene.js
node --check rain-storm.js
node --check rain-audio.js
git diff --check
```

发布前在浏览器确认入口等待、音画启动、静音切换、动画结束、语言切换、项目链接及摄影浏览；同时检查手机尺寸和控制台。语法检查不能替代这些交互检查。

当前使用 **GitHub Pages → `main` 分支 → 根目录 `/`**，`CNAME` 指向 `yaohui.me`。把修改提交并推送到 `main` 后，等待仓库的 **pages build and deployment** 流程完成。

```bash
git status
git add -- index.html rain-intro.css README.md
git commit -m "Update entry styling and project documentation"
git push origin main
```

上面的暂存列表是示例，请按实际改动补齐文件。发布成功后，访问正式网站验证新资源与交互。

## 浏览器说明

涟漪使用首屏纹理进行折射，结束后切回真实 DOM；它不是持续作用于整个页面的滤镜。声音需要用户操作解锁，因此不会在首次打开页面时自动播放。浏览器可能限制预加载或后台播放，音频失败不会阻止浏览页面。

已在应用内浏览器检查主要开场与声音交互；Safari 和实体移动设备的表现仍需单独验证。
