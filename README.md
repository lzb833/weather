# 伊川县每日天气归档

自动抓取伊川县每日历史天气数据，存入CSV文件。

## 数据来源
- [Open-Meteo](https://open-meteo.com/) 历史天气API
- 农历计算：lunar-javascript

## 数据字段
- 公历日期 / 农历日期 / 城市
- 最高气温(℃) / 最低气温(℃)
- 日出时间 / 日落时间
- 天气状况
- 降水量(mm) / 最大风速(km/h) / 平均相对湿度(%) / 气压(hPa)

## 触发方式

目标：每日北京时间 06:00 完成归档。

**主触发：外部定时器调用 workflow_dispatch**（准点，秒级启动）

GitHub Actions 自带的 `schedule` 是“尽力而为”，实测会晚 3～6 小时（甚至十几小时），所以不再依赖它。

配置方式（以 cron-job.org 为例）：

1. 创建 fine-grained PAT，授权仓库 `lzb833/weather`，权限勾选 **Actions: Read and write**。
2. 在 cron-job.org 新建任务：
   - URL：`https://api.github.com/repos/lzb833/weather/actions/workflows/daily-weather.yml/dispatches`
   - 方式：`POST`
   - 执行时间：每日 `05:55`，时区 `Asia/Shanghai`
   - Header：
     - `Authorization: Bearer <你的PAT>`
     - `Accept: application/vnd.github+json`
     - `X-GitHub-Api-Version: 2022-11-28`
   - Body：`{"ref":"main"}`

手动触发也可以用 curl：

```bash
curl -X POST \
  -H "Authorization: Bearer $GH_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/lzb833/weather/actions/workflows/daily-weather.yml/dispatches \
  -d '{"ref":"main"}'
```

**兑底：剧本自带 schedule**

保留 `cron: '0 22 * * *'`（UTC 22:00 = 北京时间 06:00）作为外部触发失败时的备份。它仍会被延迟，但脚本会判断“当天数据已存在则跳过”，不会重复写入。

## 注意事项
- 公共仓库的定时工作流超过 60 天无仓库活动会被自动禁用，外部触发也算仓库活动，可避开。
- 提交信息里的日期统一用北京时间，数据以 `Asia/Shanghai` 为准。
