# wloc-spoofer

给 WLOC 定位模块配套使用的网页：在地图上选点、搜索地点、收藏坐标，再把选中的位置写入设备上的代理工具。另有地图链接解析 API，可供快捷指令调用。

本仓库提供网页和解析服务，不包含 WLOC 定位模块。网页本身不能更改系统 GPS，也不能保证各个 App 都采用写入的位置。

## 使用前准备

设备上需要安装并启用配套 WLOC 模块，开启 MITM、信任证书，并把 `gs-loc.apple.com` 加入 MITM 主机名。模块需拦截 `https://gs-loc.apple.com/wloc-settings/save`，处理写入、查询和清除操作；这是网页与本地模块约定的接口，不是 Apple 提供的设置 API。

打开网页后，点地图或拖动标记选择位置，点击「储存到设备」。可以查询、清除设备中的坐标，或把常用位置收藏在浏览器中。收藏使用 `localStorage`，换浏览器、换站点或清除网站数据后不会自动迁移。

网页粘贴框只从文本中提取 `ll=`、`@纬度,经度`、`lnglat=`、`location=`、`center=` 或小数坐标。它不会展开短链接，也不会调用下面的解析 API；当前网页不会自动转换 GCJ-02 / BD-09 坐标。高德、百度链接或地图图层的坐标系不同，直接选点可能产生偏移。

## 地图链接解析 API

```text
GET /api/parse?u=22.5000%2C113.9000&format=json
```

返回示例：

```json
{"lat":22.5,"lon":113.9,"name":""}
```

- `u`：地图链接、含链接的分享文字，或 `纬度,经度` 小数文本。放入查询参数前需要 URL 编码。
- `format=json`：返回 JSON；省略时返回 `lat=22.5&lon=113.9` 形式的文本。
- `cs=gcj`：按 GCJ-02 转为 WGS84；`cs=none`：不转换。省略时，对识别为高德或 Apple Maps 参数的输入自动转换，代码定义的境外范围保持原值。

解析器识别 Apple Maps 的 `coordinate` / `ll` / `sll`，以及高德的 `p` / `q` 参数。输入没有直接可提取的坐标时，会尝试请求链接并跟随最多 5 次跳转。解析失败返回 HTTP 422 和 `error` 字段。

API 与网页粘贴框的格式支持和坐标处理不同。API 目前也没有完整的经纬度范围校验；使用返回值前应检查纬度在 −90 到 90、经度在 −180 到 180 之间。

## 本地开发

需要 Node.js 和 npm。在仓库根目录运行：

```bash
npm install
npm run dev
```

`dev` 使用 `npx wrangler dev`，按终端提示打开本地地址。Cloudflare Workers 的入口是 `src/index.js`，Pages 的入口是 `functions/[[route]].js`。仓库另有单文件 `wloc-worker.js`；它不是当前 Wrangler 配置的入口，修改 `src/` 不会自动更新它。

语法检查不需要安装依赖：

```bash
node --check src/index.js
node --check src/page.js
node --check src/parse.js
```

## 数据和限制

地图图层使用第三方瓦片服务，搜索地点会请求 OpenStreetMap Nominatim；Leaflet 从 unpkg 加载。浏览器会向这些服务发送相应请求。解析 API 在需要展开链接时会由服务端请求输入的 URL，部署前应评估 URL 限制、超时和请求配额。

本仓库没有自动化测试脚本，也没有配套模块的安装链接或版本要求。写入设备、MITM 拦截和不同 App 的定位效果需要与实际模块一起验证。
